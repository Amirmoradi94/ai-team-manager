import json
import os
import shlex
import subprocess
from typing import Any, Dict, List

from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

try:
    from google.adk.tools.mcp_tool.mcp_session_manager import SseConnectionParams
except Exception:
    SseConnectionParams = None


def _parse_json_array(val: Any) -> List[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(v) for v in val]
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return [str(v) for v in parsed]
        except Exception:
            return [v.strip() for v in val.split(',') if v.strip()]
    return []


def _tool_requires_approval(tool_def: Dict[str, Any]) -> bool:
    if tool_def.get('requires_approval') or tool_def.get('needs_approval'):
        return True
    config = tool_def.get('config_values')
    if isinstance(config, str):
        try:
            config = json.loads(config)
        except Exception:
            config = None
    if isinstance(config, dict):
        if config.get('requires_approval') or config.get('needs_approval'):
            return True
    return False


def build_command_tool(tool_def: Dict[str, Any], approval_requests: List[Dict[str, Any]]):
    name = tool_def.get('name') or 'custom_tool'
    description = tool_def.get('description') or 'Custom tool'
    requires_approval = _tool_requires_approval(tool_def)

    def _run_tool(**kwargs):
        if requires_approval:
            approval_requests.append({
                "type": "tool_approval",
                "tool_name": name,
                "detail": kwargs
            })
            return {"status": "approval_required", "tool": name, "args": kwargs}

        command = tool_def.get('command') or ''
        if not command:
            return {"output": "No command configured"}

        args_json = json.dumps(kwargs) if kwargs else ''
        env = os.environ.copy()
        config_values = tool_def.get('config_values')
        if isinstance(config_values, str):
            try:
                config_values = json.loads(config_values)
            except Exception:
                config_values = None
        if isinstance(config_values, dict):
            for key, value in config_values.items():
                env[str(key)] = str(value)

        parts = shlex.split(command)
        if args_json:
            parts.append(args_json)

        try:
            proc = subprocess.run(parts, capture_output=True, text=True, env=env)
            return {
                "exit_code": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr
            }
        except Exception as exc:
            return {"error": str(exc)}

    _run_tool.__name__ = name.replace(' ', '_').replace('-', '_')
    _run_tool.__doc__ = description
    return _run_tool


def build_employee_tools(employee: Dict[str, Any], approval_requests: List[Dict[str, Any]]):
    tools = []
    for tool_def in employee.get('equipped_tools') or []:
        if tool_def.get('type') == 'mcp':
            continue
        tools.append(build_command_tool(tool_def, approval_requests))
    return tools


def build_mcp_toolsets(employee: Dict[str, Any], approval_requests: List[Dict[str, Any]]):
    toolsets = []
    for tool_def in employee.get('equipped_tools') or []:
        if tool_def.get('type') != 'mcp':
            continue
        config_values = tool_def.get('config_values')
        if isinstance(config_values, str):
            try:
                config_values = json.loads(config_values)
            except Exception:
                config_values = None

        if isinstance(config_values, dict) and config_values.get('url') and SseConnectionParams:
            headers = config_values.get('headers') or {}
            connection = SseConnectionParams(url=config_values.get('url'), headers=headers)
            toolsets.append(McpToolset(connection_params=connection))
            continue

        command = tool_def.get('command') or ''
        if not command:
            continue
        parts = shlex.split(command)
        if not parts:
            continue

        server_params = StdioServerParameters(
            command=parts[0],
            args=parts[1:],
            env=os.environ.copy()
        )
        connection = StdioConnectionParams(server_params=server_params)
        toolsets.append(McpToolset(connection_params=connection))
    return toolsets
