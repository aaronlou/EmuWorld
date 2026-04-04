from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

SKILLS_DIR = Path(__file__).parent.parent.parent / ".agents" / "skills"


@dataclass
class SkillDef:
    name: str
    description: str
    role: str
    tools: List[str] = field(default_factory=list)
    workflow: List[Dict[str, Any]] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)


class SkillRegistry:
    def __init__(self, skills_path: Optional[Path] = None):
        self._path = skills_path or SKILLS_DIR
        self._skills: Dict[str, SkillDef] = {}
        self._load()

    def _load(self):
        yaml_file = self._path / "skills.yaml"
        if not yaml_file.exists():
            return
        with open(yaml_file) as f:
            data = yaml.safe_load(f) or {}
        for key, cfg in data.items():
            self._skills[key] = SkillDef(
                name=cfg.get("name", key),
                description=cfg.get("description", ""),
                role=cfg.get("role", ""),
                tools=cfg.get("tools", []),
                workflow=cfg.get("workflow", []),
                constraints=cfg.get("constraints", []),
            )

    def get(self, skill_id: str) -> Optional[SkillDef]:
        return self._skills.get(skill_id)

    def list_all(self) -> Dict[str, SkillDef]:
        return dict(self._skills)

    def list_ids(self) -> List[str]:
        return list(self._skills.keys())
