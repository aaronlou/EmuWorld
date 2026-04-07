"""
Knowledge graph layer — entity extraction, relation tracking, and causal reasoning.
Built on top of the existing memory_entries + memory_links tables.

Uses the LLM to extract entities/relations from conversations, stores them
as typed memory entries, and retrieves them for context-aware reasoning.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from .memory.store import get_memory_store, MemoryStore
from .memory.types import MemorySource, MemoryType, LinkRelation

logger = logging.getLogger("emuworld.kg")

# ── Entity Extraction ────────────────────────────────────────

# Prompt used to extract structured entities from conversation text
_EXTRACT_ENTITIES_PROMPT = """\
Given the following conversation, extract key entities (people, organizations, \
concepts, events, indicators, locations) and the relations between them.

Respond in JSON with two arrays:
- "entities": list of object with fields: name, type, description
- "relations": list of object with fields: source, relation, target

Types: person, organization, concept, event, indicator, location, dataset, policy.
Relations: causes, correlates_with, supports, contradicts, part_of, located_in, \
governs, indicates, depends_on.

Keep it concise. Only extract entities that matter for understanding the topic deeply.

Conversation:
{conversation}
"""


def extract_entities_and_relations(conversation_text: str, max_retries: int = 2) -> dict:
    """Use LLM to extract entities and relations from conversation text."""
    from agents.memory import get_memory_store, MemoryType, MemorySource
    store = get_memory_store()

    result = {"entities": [], "relations": []}
    for attempt in range(max_retries + 1):
        try:
            # Import the LLM client pattern from main.py
            from openai import OpenAI
            import os
            from dotenv import load_dotenv
            from pathlib import Path
            load_dotenv(Path(__file__).parent.parent.parent / ".env.local")

            key = os.getenv("OPENAI_API_KEY", "")
            base_url = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
            model = os.getenv("OPENAI_MODEL", "qwen/qwen3.6-plus:free")

            if not key:
                logger.warning("kg.extract: no OPENAI_API_KEY, skipping extraction")
                return result

            client = OpenAI(api_key=key, base_url=base_url)
            resp = client.chat.completions.create(
                model=model,
                messages=[{
                    "role": "system",
                    "content": "You are a precise information extractor. Respond in JSON only.",
                }, {
                    "role": "user",
                    "content": _EXTRACT_ENTITIES_PROMPT.format(conversation=conversation_text[:3000]),
                }],
                max_tokens=1024,
                temperature=0,
            )
            text = resp.choices[0].message.content or ""
            # Handle possible markdown code block wrapper
            if text.startswith("```"):
                text = " ".join(text.split("\n")[1:]).strip("`\n ").strip()
            
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                result["entities"] = parsed.get("entities", [])
                result["relations"] = parsed.get("relations", [])
                return result
        except json.JSONDecodeError:
            logger.warning(f"kg.extract: json decode error on attempt {attempt+1}")
            continue
        except Exception:
            logger.exception(f"kg.extract: error on attempt {attempt+1}")
            continue

    return result


def store_entities(entities: List[dict], source: str = "conversation") -> List[int]:
    """Store extracted entities as semantic memory entries."""
    store = get_memory_store()
    ids = []
    for e in entities:
        entry_id = store.write(
            memory_type=MemoryType.SEMANTIC,
            content=f"[{e.get('type', 'concept')}: {e['name']}] {e.get('description', '')}",
            summary=e['name'],
            tags=["kg_entity", e.get("type", ""), source],
            source=MemorySource.AGENT_GENERATED,
            confidence=0.8,
            metadata={"entity_type": e.get("type"), "raw_name": e["name"]},
        )
        if entry_id:
            ids.append(entry_id)
    return ids


def store_relations(relations: List[dict], entity_entries: dict) -> None:
    """Store relations as links between memory entries."""
    store = get_memory_store()
    for r in relations:
        src_name = r.get("source", "")
        tgt_name = r.get("target", "")
        relation_str = r.get("relation", "related_to")

        # Map to LinkRelation enum
        relation_map = {
            "causes": LinkRelation.CAUSES,
            "supports": LinkRelation.SUPPORTS,
            "contradicts": LinkRelation.CONTRADICTS,
            "correlates_with": LinkRelation.RELATED_TO,
            "depends_on": LinkRelation.RELATED_TO,
        }
        relation = relation_map.get(relation_str, LinkRelation.RELATED_TO)

        # Find the entity by name
        src_id = entity_entries.get(src_name)
        tgt_id = entity_entries.get(tgt_name)
        if src_id and tgt_id:
            store.link(src_id, tgt_id, relation)


# ── Retrieval ────────────────────────────────────────────────

def get_related_context(query: str, top_k: int = 5) -> str:
    """Retrieve related entities and their relations for context enrichment."""
    store = get_memory_store()

    # Search for matching entities
    results = store.search(query, memory_type=MemoryType.SEMANTIC, top_k=top_k)
    if not results:
        return ""

    lines = ["--- Knowledge graph context ---"]
    for entry in results:
        lines.append(f"  ENTITY [{entry.metadata.get('entity_type', 'concept')}]: {entry.content}")
        # Get links
        links = store.get_links(entry.id)
        for link in links[:3]:
            relation = link.get("relation", "")
            target = link.get("target_content", "")
            lines.append(f"    — {relation} → {target[:100]}")

    return "\n".join(lines)


def extract_and_store_conversation(user_msg: str, ai_response: str) -> None:
    """Full pipeline: extract entities/relations from conversation and persist."""
    try:
        conversation = f"User: {user_msg}\nAI: {ai_response}"
        extracted = extract_entities_and_relations(conversation)

        if not extracted["entities"]:
            return

        # Store entities
        entity_ids = store_entities(extracted["entities"])

        # Build name→id mapping
        entity_map = {}
        for e in extracted["entities"]:
            name = e.get("name", "")
            if name:
                entity_map[name] = entity_ids[extracted["entities"].index(e)]

        # Store relations
        store_relations(extracted["relations"], entity_map)

        logger.info(
            f"kg: extracted {len(extracted['entities'])} entities, "
            f"{len(extracted['relations'])} relations from conversation"
        )
    except Exception:
        logger.exception("kg.extract_and_store: failed")
