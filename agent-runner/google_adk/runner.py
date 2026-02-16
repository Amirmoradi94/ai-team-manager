import asyncio
import json
import os
import sys
import traceback
import uuid
from typing import Any, Dict

sys.path.insert(0, os.path.dirname(__file__))

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agent_builder import build_employee_agents, build_manager_agent
from skills import cleanup_runtime_skills


def _read_input() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("No input provided to Google ADK runner")
    return json.loads(raw)


def _safe(obj: Any) -> Any:
    try:
        json.dumps(obj)
        return obj
    except Exception:
        return str(obj)


def _extract_text(event) -> str:
    content = getattr(event, 'content', None)
    if not content:
        return ''
    parts = getattr(content, 'parts', None)
    if not parts:
        return ''
    texts = []
    for part in parts:
        text = getattr(part, 'text', None)
        if text:
            texts.append(text)
    return "\n".join(texts).strip()


def _extract_usage(event) -> Dict[str, Any]:
    response = getattr(event, 'response', None)
    usage = None
    if response is not None:
        usage = getattr(response, 'usage_metadata', None) or getattr(response, 'usageMetadata', None)
    if usage is None:
        return {}
    prompt_tokens = getattr(usage, 'prompt_token_count', None) or getattr(usage, 'promptTokenCount', None)
    completion_tokens = getattr(usage, 'candidates_token_count', None) or getattr(usage, 'candidatesTokenCount', None)
    total_tokens = getattr(usage, 'total_token_count', None) or getattr(usage, 'totalTokenCount', None)
    return {
        'input_tokens': prompt_tokens,
        'output_tokens': completion_tokens,
        'total_tokens': total_tokens
    }


def _is_final(event) -> bool:
    if hasattr(event, 'is_final_response'):
        try:
            return event.is_final_response()
        except Exception:
            return False
    return False


async def _run(payload: Dict[str, Any]) -> Dict[str, Any]:
    actor_type = payload.get('actor_type') or 'team_lead'
    prompt = payload.get('prompt') or ''
    model = payload.get('model') or None
    identity = payload.get('identity') or {}
    employees = payload.get('employees') or []
    project_dir = payload.get('project_dir') or os.getcwd()

    if not os.getenv('GOOGLE_API_KEY'):
        raise RuntimeError('GOOGLE_API_KEY is not set')

    approval_requests = []
    runtime_id = uuid.uuid4().hex
    runtime_skills_dir = os.path.join(os.path.dirname(__file__), 'runtime_skills', runtime_id)

    employee_agents = build_employee_agents(
        employees=employees,
        base_model=model,
        runtime_skills_dir=runtime_skills_dir,
        approval_requests=approval_requests
    )
    manager = build_manager_agent(
        actor_type=actor_type,
        identity=identity,
        employees=employees,
        employee_agents=employee_agents,
        base_model=model
    )

    app_name = 'ai-team-manager'
    session_service = InMemorySessionService()
    runner = Runner(agent=manager, app_name=app_name, session_service=session_service)
    user_id = identity.get('id') or 'cto'
    session_id = f"{actor_type}-{uuid.uuid4().hex}"
    await session_service.create_session(app_name=app_name, user_id=user_id, session_id=session_id)

    content = types.Content(role='user', parts=[types.Part(text=prompt)])

    final_text = ''
    usage = {}
    async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=content):
        if _is_final(event):
            final_text = _extract_text(event)
            usage = _extract_usage(event)

    cleanup_runtime_skills(runtime_skills_dir)

    return {
        'success': bool(final_text),
        'final_output': final_text or '',
        'usage': usage or None,
        'tool_calls': None,
        'needs_approval': bool(approval_requests),
        'approval_requests': approval_requests,
        'raw_result': None
    }


def main() -> None:
    try:
        payload = _read_input()
        result = asyncio.run(_run(payload))
        sys.stdout.write(json.dumps(result))
    except Exception as exc:
        err = {
            'success': False,
            'final_output': '',
            'error': str(exc),
            'trace': traceback.format_exc()
        }
        sys.stdout.write(json.dumps(err))


if __name__ == '__main__':
    main()
