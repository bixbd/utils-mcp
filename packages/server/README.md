# @bixbd/utils-mcp

Connect utility portals to AI agents through the [Model Context Protocol](https://modelcontextprotocol.io). It runs on your own computer over stdio, so your credentials never leave your machine.

> **Beta.** Expect changes. Published under the `next` tag.

## What it does

You enable the connectors you want. Each connector adds a few task-shaped tools (like `desco_get_balance`) to your AI app. Only enabled connectors are loaded, so the AI's tool list stays small.

| Connector | Tools | Credentials |
| --- | --- | --- |
| `desco` ([package](https://www.npmjs.com/package/@bixbd/utils-mcp-connector-desco)) | `desco_list_accounts`, `desco_get_balance`, `desco_get_realtime_status` | `DESCO_USERNAME`, `DESCO_PASSWORD` |
| `example` (repo only) | `example_get_status` | none |

## Requirements

[Node.js](https://nodejs.org) 18 or newer. The package is a single file with no dependencies, and the `desco` connector is built in.

## Install

**Claude Desktop, no terminal:** download `utils-mcp.mcpb` from the [latest release](https://github.com/bixbd/utils-mcp/releases), double-click it and enter your login. Claude Desktop keeps the password in the OS keychain. (Build it yourself with `bun run pack:mcpb`.)

**Any app:** run the setup. It asks for your portal login, finds your AI apps and configures them:

```bash
npx -y @bixbd/utils-mcp@next setup
```

It supports Claude Desktop, Claude Code, Cursor, Windsurf, VS Code and Gemini CLI. For anything else it prints a snippet to paste. Restart your AI app afterwards and ask something like "What is my DESCO balance?"

## Add it by hand

Every MCP app takes the same three things: a command, arguments and environment variables.

```json
{
  "mcpServers": {
    "utils": {
      "command": "npx",
      "args": ["-y", "@bixbd/utils-mcp@next"],
      "env": { "DESCO_USERNAME": "your-username", "DESCO_PASSWORD": "your-password" }
    }
  }
}
```

VS Code uses the key `servers` instead of `mcpServers`. For Claude Code:

```bash
claude mcp add utils -e DESCO_USERNAME=your-username -e DESCO_PASSWORD=your-password -- npx -y @bixbd/utils-mcp@next
```

If an app cannot find `npx` (some desktop apps do not see your shell PATH), use the full path from `which npx` as the command.

## Choose connectors

By default every built-in connector is on, and only the ones with credentials will work. To limit them, set `UTILS_MCP_ENABLED=desco` (comma separated) in the same `env` block. Alternatively, create `~/.utils-mcp/config.json`:

```json
{ "enabled": ["desco"] }
```

Connectors that are not built in are separate packages (`@bixbd/utils-mcp-connector-<id>`) that you install next to the server.

## Multiple accounts

Add a label after two underscores and pass it as `account` in the tool call:

```
DESCO_USERNAME__OFFICE=...
DESCO_PASSWORD__OFFICE=...
```

Then ask "check the office DESCO account", and the AI calls the tool with `account: "office"`. Without a label, the default account is used.

## Troubleshooting

| Message | Fix |
| --- | --- |
| Cannot find the connector package | Only built-in connectors work out of the box. Install others with `npm install @bixbd/utils-mcp-connector-<id>@next` in the folder the server runs from. |
| The app says the server failed to start | Install Node.js 18+, or put the full path to `npx` in the config. |
| A tool says credentials are missing | Add the environment variables to your app's MCP config (the `env` block). |
| The portal changed | The tool returns `UPSTREAM_CHANGED`. Open an issue with the tool name. |

Set the config path with `UTILS_MCP_CONFIG=/path/to/config.json` if you keep it elsewhere. Logs go to stderr, never stdout.

## Security

- Credentials come from environment variables and are sent only to the portal over HTTPS.
- Sessions are kept in memory only. Nothing is written to disk.
- Account numbers are masked in tool output.
- Use only accounts you own or have permission to access. Connectors are unofficial and not affiliated with the portals.

## Links

[Source and issues](https://github.com/bixbd/utils-mcp) · [Write a connector](https://github.com/bixbd/utils-mcp/blob/main/docs/ADDING_A_CONNECTOR.md) · MIT License
