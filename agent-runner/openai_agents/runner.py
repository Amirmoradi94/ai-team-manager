import asyncio
import json
import os
import sys
import traceback
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(__file__))

from agents import Agent, Runner
from tools import build_mcp_servers
from agent_builder import build_employee_agents, build_manager_agent


def _read_input() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("No input provided to OpenAI Agents runner")
    return json.loads(raw)


def _safe(obj: Any) -> Any:
    try:
        json.dumps(obj)
        return obj
    except Exception:
        return str(obj)


async def _run(payload: Dict[str, Any]) -> Dict[str, Any]:
    actor_type = payload.get("actor_type")
    prompt = payload.get("prompt") or ""
    model = payload.get("model") or None
    identity = payload.get("identity") or {}
    employees = payload.get("employees") or []
    project_dir = payload.get("project_dir") or os.getcwd()

    # Build MCP servers (if any) and agents
    mcp_servers = build_mcp_servers(employees)

    async with mcp_servers as active_mcp:
        employee_agents = build_employee_agents(
            employees=employees,
            base_model=model,
            mcp_servers=active_mcp
        )
        manager = build_manager_agent(
            actor_type=actor_type or "team_lead",
            identity=identity,
            employees=employees,
            employee_agents=employee_agents,
            base_model=model,
            mcp_servers=active_mcp
        )

        result = await Runner.run(
            manager,
            prompt,
            context={
                "project_dir": project_dir,
                "actor_type": actor_type,
                "identity": identity,
            }
        )

    output_text = result.final_output if hasattr(result, "final_output") else None
    usage = None
    try:
        usage = result.context_wrapper.usage
    except Exception:
        usage = None
    interruptions = getattr(result, "interruptions", None)

    approval_requests = []
    if interruptions:
        for it in interruptions:
            approval_requests.append({
                "type": getattr(it, "type", None) or it.__class__.__name__,
                "detail": _safe(getattr(it, "detail", None)),
                "tool_name": getattr(it, "tool_name", None),
                "call_id": getattr(it, "call_id", None)
            })

    return {
        "success": bool(output_text),
        "final_output": output_text or "",
        "usage": _safe(usage) if usage else None,
        "tool_calls": _safe(getattr(result, "tool_calls", None)) if hasattr(result, "tool_calls") else None,
        "needs_approval": bool(approval_requests),
        "approval_requests": approval_requests,
        "raw_result": _safe(result)
    }


def main() -> None:
    try:
        payload = _read_input()
        result = asyncio.run(_run(payload))
        sys.stdout.write(json.dumps(result))
    except Exception as exc:
        err = {
            "success": False,
            "final_output": "",
            "error": str(exc),
            "trace": traceback.format_exc()
        }
        sys.stdout.write(json.dumps(err))


if __name__ == "__main__":
    main()
