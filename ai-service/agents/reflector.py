"""
Reflector Agent — self-reflection, uncertainty expression, and counter-argument generation.
Transforms AI responses from "confident assertions" into "nuanced, honest reasoning".
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, Optional

from openai import OpenAI

logger = logging.getLogger("emuworld.reflector")

_REFLECT_PROMPT = """\
You are the Reflector, a meta-cognitive agent that reviews an AI's draft response.
Your job is NOT to rewrite the answer — it's to add intellectual honesty to it.

Given the user's question and the AI's draft answer, respond in JSON with:

{
  "confidence": <0.0 to 1.0, how certain is this answer>,
  "uncertainties": ["what the AI does NOT know", "key missing variables", "data gaps"],
  "counter_arguments": ["reasonable opposing views or alternative interpretations"],
  "evidence_weaknesses": ["which claims in the answer rest on shaky ground"],
  "suggested_follow_up": ["1-2 specific questions the user should ask to reduce uncertainty"]
}

Be precise and specific. No vague disclaimers. Each point should be actionable.
Keep uncertainties and counter_arguments to 1-3 items each.
If the answer is straightforward and well-supported, it's fine to return empty arrays.
"""


def _get_client() -> Optional[OpenAI]:
    env_file = Path(__file__).parent.parent / ".env.local"
    if env_file.exists():
        from dotenv import load_dotenv
        load_dotenv(env_file)

    key = os.getenv("OPENAI_API_KEY", "")
    if not key:
        return None

    return OpenAI(api_key=key, base_url=os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1"))


def reflect(user_question: str, draft_answer: str) -> Optional[dict]:
    """Review a draft answer and add intellectual honesty metadata."""
    client = _get_client()
    if not client:
        return None

    try:
        resp = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "qwen/qwen3.6-plus:free"),
            messages=[
                {"role": "system", "content": "JSON only, no preamble."},
                {"role": "user", "content": _REFLECT_PROMPT + f"\n\nQuestion: {user_question}\nDraft answer: {draft_answer}"},
            ],
            max_tokens=512,
            temperature=0.1,
        )
        text = resp.choices[0].message.content or ""
        # Strip markdown code blocks if present
        if text.startswith("```"):
            lines = text.strip().split("\n")
            text = "\n".join(lines[1:-1]).strip("`\n ")
        result = json.loads(text)
        if isinstance(result, dict) and "confidence" in result:
            return result
    except json.JSONDecodeError:
        logger.warning("reflector: JSON decode error")
    except Exception:
        logger.exception("reflector: error")

    return None


def enrich_answer(user_question: str, draft_answer: str, reflection: dict) -> str:
    """Attach reflection data to the draft answer as structured text."""
    parts = [draft_answer]

    conf = reflection.get("confidence", 0.5)
    uncertainties = reflection.get("uncertainties", [])
    counter_args = reflection.get("counter_arguments", [])
    weak = reflection.get("evidence_weaknesses", [])
    follow_up = reflection.get("suggested_follow_up", [])

    meta_lines = []
    meta_lines.append(f"\n--- 可信度 {int(conf * 100)}% ---")

    if uncertainties:
        meta_lines.append("我不确定的是：")
        for u in uncertainties[:3]:
            meta_lines.append(f"  · {u}")

    if counter_args:
        meta_lines.append("不同观点的可能理由：")
        for c in counter_args[:3]:
            meta_lines.append(f"  · {c}")

    if weak:
        meta_lines.append("证据较弱的推断：")
        for w in weak[:3]:
            meta_lines.append(f"  · {w}")

    if follow_up:
        meta_lines.append("建议追问：")
        for f in follow_up[:2]:
            meta_lines.append(f"  · {f}")

    return "\n".join(parts + meta_lines)
