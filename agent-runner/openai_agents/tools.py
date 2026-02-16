import asyncio
import json
import os
import shlex
from typing import Any, Dict, List, Optional

from agents import function_tool
from agents.mcp import MCPServerManager, MCPServerStdio, MCPServerStreamableHttp


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


def build_command_tool(tool_def: Dict[str, Any]):
    name = tool_def.get('name') or 'custom_tool'
    description = tool_def.get('description') or 'Custom tool'
    requires_approval = _tool_requires_approval(tool_def)

    @function_tool(name=name, description=description, needs_approval=requires_approval)
    async def _run_tool(**kwargs):
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
            proc = await asyncio.create_subprocess_exec(
                *parts,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            stdout, stderr = await proc.communicate()
            return {
                "exit_code": proc.returncode,
                "stdout": stdout.decode('utf-8', errors='ignore'),
                "stderr": stderr.decode('utf-8', errors='ignore')
            }
        except Exception as exc:
            return {"error": str(exc)}

    return _run_tool


def build_mcp_servers(employees: List[Dict[str, Any]]):
    servers = []
    for emp in employees:
        for tool_def in emp.get('equipped_tools') or []:
            if tool_def.get('type') != 'mcp':
                continue
            command = tool_def.get('command') or ''
            config_values = tool_def.get('config_values')
            if isinstance(config_values, str):
                try:
                    config_values = json.loads(config_values)
                except Exception:
                    config_values = None
            if isinstance(config_values, dict) and config_values.get('url'):
                approval = 'always' if _tool_requires_approval(tool_def) else 'never'
                servers.append(MCPServerStreamableHttp(
                    name=tool_def.get('name') or 'mcp',
                    params={
                        "url": config_values.get('url'),
                        "headers": config_values.get('headers') or {}
                    },
                    require_approval=approval
                ))
            elif command:
                parts = shlex.split(command)
                if not parts:
                    continue
                approval = 'always' if _tool_requires_approval(tool_def) else 'never'
                servers.append(MCPServerStdio(
                    name=tool_def.get('name') or parts[0],
                    params={
                        "command": parts[0],
                        "args": parts[1:]
                    },
                    require_approval=approval
                ))
    return MCPServerManager(servers)


def build_employee_tools(employee: Dict[str, Any]):
    tools = []
    for tool_def in employee.get('equipped_tools') or []:
        if tool_def.get('type') == 'mcp':
            continue
        tools.append(build_command_tool(tool_def))
    return tools
