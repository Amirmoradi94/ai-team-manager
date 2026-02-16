import json
import os
import shutil
from typing import List

from google.adk.skills import load_skill_from_dir
from google.adk.tools import skill_toolset

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


def _parse_json_array(value) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(v) for v in parsed]
        except Exception:
            return [v.strip() for v in value.split(',') if v.strip()]
    return []


def _find_skill_source(skill_name: str) -> str:
    for base in SKILL_DIRS:
        if not os.path.isdir(base):
            continue
        candidates = [
            os.path.join(base, f"{skill_name}.md"),
            os.path.join(base, skill_name, 'SKILL.md'),
            os.path.join(base, skill_name, f"{skill_name}.md"),
        ]
        for path in candidates:
            if os.path.isfile(path):
                return path
    return ''


def build_skill_toolset(skill_names: List[str], runtime_root: str):
    if not skill_names:
        return None

    os.makedirs(runtime_root, exist_ok=True)
    loaded_skills = []

    for skill_name in skill_names:
        dest_dir = os.path.join(runtime_root, skill_name)
        os.makedirs(dest_dir, exist_ok=True)
        dest_file = os.path.join(dest_dir, 'SKILL.md')

        source = _find_skill_source(skill_name)
        if source:
            content = _read_file(source)
            with open(dest_file, 'w', encoding='utf-8') as f:
                f.write(content)
        else:
            with open(dest_file, 'w', encoding='utf-8') as f:
                f.write(f"# {skill_name}\n\nNo description found.\n")

        loaded_skills.append(load_skill_from_dir(dest_dir))

    return skill_toolset.SkillToolset(skills=loaded_skills)


def parse_employee_skills(employee) -> List[str]:
    return _parse_json_array(employee.get('tools'))


def cleanup_runtime_skills(runtime_root: str):
    try:
        shutil.rmtree(runtime_root, ignore_errors=True)
    except Exception:
        pass
