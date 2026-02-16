import os
from typing import Any, Dict, List

from google.adk.agents import LlmAgent

from skills import build_skill_toolset, parse_employee_skills
from tools import build_employee_tools, build_mcp_toolsets


def _default_model(model: str) -> str:
    return model or 'gemini-3-pro-preview'


def build_employee_agents(employees: List[Dict[str, Any]], base_model: str, runtime_skills_dir: str, approval_requests: List[Dict[str, Any]]):
    agents = []
    for employee in employees:
        name = employee.get('name') or 'Employee'
        description = employee.get('description') or 'Sub-agent'
        instruction = employee.get('system_prompt') or ''
        model = _default_model(employee.get('model_gemini') or base_model)

        skills = parse_employee_skills(employee)
        skill_toolset = build_skill_toolset(skills, os.path.join(runtime_skills_dir, name.replace(' ', '_')))

        tools = []
        if skill_toolset:
            tools.append(skill_toolset)
        tools.extend(build_employee_tools(employee, approval_requests))
        tools.extend(build_mcp_toolsets(employee, approval_requests))

        agents.append(LlmAgent(
            name=name,
            description=description,
            model=model,
            instruction=instruction,
            tools=tools
        ))
    return agents


def build_manager_agent(actor_type: str, identity: Dict[str, Any], employees: List[Dict[str, Any]], employee_agents: List[LlmAgent], base_model: str):
    name = identity.get('name') or ('CTO' if actor_type == 'cto' else 'Team Lead')
    instruction_parts = [
        identity.get('system_prompt', ''),
        '',
        'You must delegate to employees to use any skill or tool they are equipped with.',
        'Do not invoke skills/tools directly from the manager agent.',
        'If you need clarification, respond with:',
        '---NEEDS_CLARIFICATION---',
        '[Your questions for CEO]',
        '---END_CLARIFICATION---'
    ]
    instruction = "\n".join([p for p in instruction_parts if p is not None]).strip()

    return LlmAgent(
        name=name,
        description=identity.get('description') or name,
        model=_default_model(base_model),
        instruction=instruction,
        sub_agents=employee_agents
    )
