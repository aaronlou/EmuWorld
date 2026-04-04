from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class PermissionLevel(Enum):
    VIEWER = "viewer"
    ANALYST = "analyst"
    ADMIN = "admin"


@dataclass
class PermissionCheck:
    resource: str
    action: str
    level: PermissionLevel
    allowed: bool
    reason: Optional[str] = None


ALLOWED_ACTIONS = {
    PermissionLevel.VIEWER: {"read", "query"},
    PermissionLevel.ANALYST: {"read", "query", "analyze", "forecast", "export"},
    PermissionLevel.ADMIN: {
        "read",
        "query",
        "analyze",
        "forecast",
        "export",
        "sync_sources",
        "manage",
    },
}

PUBLIC_SOURCES = {"world_bank", "imf", "oecd", "eurostat", "nbs"}
RESTRICTED_SOURCES = {"fred"}


def check_permission(
    resource: str,
    action: str,
    level: PermissionLevel,
) -> PermissionCheck:
    allowed_actions = ALLOWED_ACTIONS.get(level, set())
    if action not in allowed_actions:
        return PermissionCheck(
            resource=resource,
            action=action,
            level=level,
            allowed=False,
            reason=f"Action '{action}' requires higher permission level",
        )

    if resource in RESTRICTED_SOURCES and level == PermissionLevel.VIEWER:
        return PermissionCheck(
            resource=resource,
            action=action,
            level=level,
            allowed=False,
            reason=f"Source '{resource}' requires analyst level or above",
        )

    return PermissionCheck(
        resource=resource,
        action=action,
        level=level,
        allowed=True,
    )
