#!/usr/bin/env python3
"""Sync canonical skills from docs/skills to tool-specific entry points.

This script keeps three artifacts aligned:
1) docs/skills/skills.manifest.json (machine-readable manifest for Python tooling)
2) .claude/skills/<skill-name>/... (Claude skill mirror)
3) .github/copilot-instructions.md (auto-synced skill index block)

Usage:
  python3 scripts/sync-skills.py --write
  python3 scripts/sync-skills.py --check
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parent.parent
DOCS_SKILLS_DIR = ROOT / "docs" / "skills"
CLAUDE_SKILLS_DIR = ROOT / ".claude" / "skills"
COPILOT_FILE = ROOT / ".github" / "copilot-instructions.md"
MANIFEST_FILE = DOCS_SKILLS_DIR / "skills.manifest.json"
MANAGED_MARKER = ".managed-by-docs-skill-sync"
MARKER_START = "<!-- SKILLS_SYNC_START -->"
MARKER_END = "<!-- SKILLS_SYNC_END -->"


@dataclass(frozen=True)
class Skill:
    folder: Path
    name: str
    description: str


def parse_frontmatter(skill_md: Path) -> Tuple[str, str]:
    text = skill_md.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError(f"Missing YAML frontmatter in {skill_md}")

    try:
        end_idx = lines.index("---", 1)
    except ValueError as exc:
        raise ValueError(f"Unclosed YAML frontmatter in {skill_md}") from exc

    fields: Dict[str, str] = {}
    for raw in lines[1:end_idx]:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key in {"name", "description"}:
            fields[key] = value

    name = fields.get("name", "").strip()
    description = fields.get("description", "").strip()
    if not name:
        raise ValueError(f"Frontmatter missing 'name' in {skill_md}")
    if not description:
        raise ValueError(f"Frontmatter missing 'description' in {skill_md}")
    return name, description


def discover_skills() -> List[Skill]:
    skills: List[Skill] = []
    for path in sorted(DOCS_SKILLS_DIR.glob("*/SKILL.md")):
        folder = path.parent
        name, description = parse_frontmatter(path)
        skills.append(Skill(folder=folder, name=name, description=description))
    if not skills:
        raise RuntimeError(f"No skills found under {DOCS_SKILLS_DIR}")
    return sorted(skills, key=lambda s: s.name)


def skill_files(folder: Path) -> List[Path]:
    files = [p for p in folder.rglob("*") if p.is_file()]
    return sorted(files)


def build_manifest(skills: List[Skill]) -> str:
    data = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "sourceRoot": "docs/skills",
        "skills": [],
    }
    for skill in skills:
        files = skill_files(skill.folder)
        refs = [
            str(p.relative_to(ROOT)).replace("\\", "/")
            for p in files
            if p.name != "SKILL.md"
        ]
        entry = {
            "name": skill.name,
            "description": skill.description,
            "source": str((skill.folder / "SKILL.md").relative_to(ROOT)).replace("\\", "/"),
            "references": refs,
        }
        data["skills"].append(entry)

    return json.dumps(data, indent=2, ensure_ascii=True) + "\n"


def build_copilot_skills_block(skills: List[Skill]) -> str:
    lines = [
        MARKER_START,
        "## Canonical Skill Sources (Auto-Synced)",
        "",
        "These files are the canonical source for pipeline/review/payment behavior. Keep changes there first:",
    ]
    for skill in skills:
        rel = (skill.folder / "SKILL.md").relative_to(ROOT)
        lines.append(f"- `{rel.as_posix()}` ({skill.name})")
    lines.extend([
        "",
        "For non-Codex tooling:",
        "- Python tools should read `docs/skills/skills.manifest.json`.",
        "- Claude mirror is auto-synced to `.claude/skills/<name>/`.",
        MARKER_END,
        "",
    ])
    return "\n".join(lines)


def upsert_copilot_block(existing: str, block: str) -> str:
    if MARKER_START in existing and MARKER_END in existing:
        start = existing.index(MARKER_START)
        end = existing.index(MARKER_END) + len(MARKER_END)
        updated = existing[:start] + block.rstrip("\n") + existing[end:]
        if not updated.endswith("\n"):
            updated += "\n"
        return updated

    if "\n\n" in existing:
        head, tail = existing.split("\n\n", 1)
        return head + "\n\n" + block + tail

    return block + existing


def compute_expected_outputs(skills: List[Skill], copilot_existing: str) -> Dict[Path, bytes]:
    out: Dict[Path, bytes] = {}

    # Manifest for Python and other automation.
    out[MANIFEST_FILE] = build_manifest(skills).encode("utf-8")

    # Mirror docs skills into Claude skill folders by frontmatter name.
    for skill in skills:
        src_files = skill_files(skill.folder)
        for src in src_files:
            rel = src.relative_to(skill.folder)
            dest = CLAUDE_SKILLS_DIR / skill.name / rel
            out[dest] = src.read_bytes()
        out[CLAUDE_SKILLS_DIR / skill.name / MANAGED_MARKER] = (
            b"Managed by scripts/sync-skills.py\n"
        )

    # Keep a lightweight auto-synced index in Copilot instructions.
    copilot_updated = upsert_copilot_block(copilot_existing, build_copilot_skills_block(skills))
    out[COPILOT_FILE] = copilot_updated.encode("utf-8")

    return out


def write_outputs(expected: Dict[Path, bytes]) -> None:
    for path, content in expected.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def check_outputs(expected: Dict[Path, bytes]) -> int:
    mismatches: List[str] = []
    for path, content in expected.items():
        if not path.exists():
            mismatches.append(f"MISSING: {path.relative_to(ROOT)}")
            continue
        current = path.read_bytes()
        if current != content:
            mismatches.append(f"DIFFERS: {path.relative_to(ROOT)}")

    if mismatches:
        print("Skill sync check failed. Run: python3 scripts/sync-skills.py --write")
        for item in mismatches:
            print(f"- {item}")
        return 1

    print("Skill sync check passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync docs skills to manifest + Claude + Copilot")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="Write all synced outputs")
    mode.add_argument("--check", action="store_true", help="Check outputs without writing")
    args = parser.parse_args()

    skills = discover_skills()
    copilot_existing = COPILOT_FILE.read_text(encoding="utf-8") if COPILOT_FILE.exists() else ""
    expected = compute_expected_outputs(skills, copilot_existing)

    if args.write:
        write_outputs(expected)
        print("Skill sync write completed.")
        return 0

    return check_outputs(expected)


if __name__ == "__main__":
    raise SystemExit(main())
