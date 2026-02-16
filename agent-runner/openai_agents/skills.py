import os
from typing import List


SKILL_DIRS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'skills', 'documentation')),
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.claude', 'skills')),
]


def _read_file(path: str) -> str:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception:
        return ''


def load_skill_content(skill_name: str) -> str:
    candidates = []
    for base in SKILL_DIRS:
        if not os.path.isdir(base):
            continue
        candidates.extend([
            os.path.join(base, f"{skill_name}.md"),
            os.path.join(base, skill_name, 'SKILL.md'),
            os.path.join(base, skill_name, f"{skill_name}.md"),
        ])
    for path in candidates:
        if os.path.isfile(path):
            return _read_file(path)
    return ''


def build_skills_block(skills: List[str]) -> str:
    if not skills:
        return 'Skills: none'
    blocks = []
    for s in skills:
        content = load_skill_content(s)
        if content:
            blocks.append(f"## Skill: {s}\n{content.strip()}")
        else:
            blocks.append(f"## Skill: {s}\n(No description found.)")
    return "\n\n".join(blocks)
