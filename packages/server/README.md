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

[Bun](https://bun.sh) 1.1 or newer. The server runs TypeScript directly with Bun.

## Install

Install the server and the connectors you need into one folder. Connectors are separate packages, and the server loads them from the folder it is installed in.

```bash
mkdir -p ~/.utils-mcp && cd ~/.utils-mcp
bun add @bixbd/utils-mcp@next @bixbd/utils-mcp-connector-desco@next
```

## Choose connectors

Create `~/.utils-mcp/config.json`. Nothing is enabled by default.

```json
{ "enabled": ["desco"] }
```

Each name `<id>` loads the package `@bixbd/utils-mcp-connector-<id>`, so it must be installed in the same folder.

## Add it to your AI app

Use the full path, because most apps do not expand `~`.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "utils": {
      "command": "/Users/you/.utils-mcp/node_modules/.bin/utils-mcp",
      "env": { "DESCO_USERNAME": "your-username", "DESCO_PASSWORD": "your-password" }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add utils -e DESCO_USERNAME=your-username -e DESCO_PASSWORD=your-password -- ~/.utils-mcp/node_modules/.bin/utils-mcp
```

Restart the app, then ask something like "What is my DESCO balance?"

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
| `no connectors enabled` | Create `~/.utils-mcp/config.json` with `{"enabled": ["desco"]}`. |
| Cannot find the connector package | Run `bun add @bixbd/utils-mcp-connector-<id>@next` inside `~/.utils-mcp`. |
| A tool says credentials are missing | Add the environment variables to your app's MCP config (the `env` block). |
| The portal changed | The tool returns `UPSTREAM_CHANGED`. Open an issue with the tool name. |

Set the config path with `UTILS_MCP_CONFIG=/path/to/config.json` if you keep it elsewhere. Logs go to stderr, never stdout.

## Security

- Credentials come from environment variables and are sent only to the portal over HTTPS.
- Sessions are kept in memory only. Nothing is written to disk.
- Account numbers are masked in tool output.
- Use only accounts you own or have permission to access. Connectors are unofficial and not affiliated with the portals.

## Links

[Source and issues](https://github.com/bixbd/utils-mcp) · [Write a connector](https://github.com/bixbd/utils-mcp/blob/main/CONTRIBUTING.md) · MIT License
