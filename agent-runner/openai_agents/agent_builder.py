from typing import Any, Dict, List

from agents import Agent

from skills import build_skills_block
from tools import build_employee_tools


def _parse_json_array(val: Any) -> List[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(v) for v in val]
    if isinstance(val, str):
        try:
            import json
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return [str(v) for v in parsed]
        except Exception:
            return [v.strip() for v in val.split(',') if v.strip()]
    return []


def build_employee_agents(employees: List[Dict[str, Any]], base_model: str, mcp_servers):
    agents = []
    for emp in employees:
        skills = _parse_json_array(emp.get('tools'))
        skill_block = build_skills_block(skills)
        tool_names = [t.get('name') for t in emp.get('equipped_tools') or []]

        instructions = "\n".join([
            emp.get('system_prompt') or '',
            '',
            'You may only use skills/tools you are explicitly equipped with.',
            'If you need a tool/skill outside your equipment, ask the Team Lead.',
            '',
            f"Skills: {', '.join(skills) if skills else 'none'}",
            f"Tools: {', '.join(tool_names) if tool_names else 'none'}",
            '',
            skill_block
        ]).strip()

        tools = build_employee_tools(emp)
        agents.append(Agent(
            name=emp.get('name') or 'Employee',
            instructions=instructions,
            model=emp.get('model_openai') or base_model,
            tools=tools,
            mcp_servers=mcp_servers
        ))
    return agents


def build_manager_agent(actor_type: str, identity: Dict[str, Any], employees: List[Dict[str, Any]], employee_agents: List[Agent], base_model: str, mcp_servers):
    employee_tools = []
    for agent in employee_agents:
        employee_tools.append(agent.as_tool())

    policy = [
        identity.get('system_prompt') or '',
        '',
        'Tool/Skill Policy:',
        '- You MUST delegate to the specific employee who has a tool/skill before it is used.',
        '- Do not invoke skills/tools directly from the Team Lead.',
        '- If no equipped employee exists, ask for clarification.',
        '',
        'If you need clarification, respond with:',
        '---NEEDS_CLARIFICATION---',
        '[Your questions for CEO]',
        '---END_CLARIFICATION---'
    ]

    instructions = "\n".join(policy).strip()

    name = 'CTO' if actor_type == 'cto' else 'Team Lead'
    return Agent(
        name=name,
        instructions=instructions,
        model=base_model,
        tools=employee_tools,
        mcp_servers=mcp_servers
    )
