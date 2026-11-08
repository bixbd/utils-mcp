# utils-mcp

Let your AI assistant use everyday utility portals for you. Ask in plain language, get the answer, and keep your credentials on your own computer.

> **Beta.** Published on npm under the `next` tag. More connectors are coming.

> "What's my DESCO prepaid balance?"

utils-mcp is a local [MCP](https://modelcontextprotocol.io) server. Each utility portal is a small **connector** that gives your AI a few clear tools. You turn on only the connectors you need.

## Quick start (3 steps)

You need [Bun](https://bun.sh) 1.1 or newer and an MCP-capable app such as Claude Desktop or Claude Code.

**1. Install the server and the connectors you want**

```bash
mkdir -p ~/.utils-mcp && cd ~/.utils-mcp
bun add @bixbd/utils-mcp@next @bixbd/utils-mcp-connector-desco@next
```

**2. Choose what is enabled**

```bash
echo '{ "enabled": ["desco"] }' > ~/.utils-mcp/config.json
```

**3. Add it to your AI app** with your portal login. Use the full path, because most apps do not expand `~`.

Claude Desktop (`claude_desktop_config.json`):

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

Claude Code:

```bash
claude mcp add utils -e DESCO_USERNAME=your-username -e DESCO_PASSWORD=your-password -- ~/.utils-mcp/node_modules/.bin/utils-mcp
```

Restart the app and ask your question. More detail, including several accounts per portal and troubleshooting, is in the [server guide](packages/server/README.md).

## Available connectors

| Connector | What you can ask | Credentials |
| --- | --- | --- |
| [`desco`](connectors/desco/README.md) | List linked DESCO prepaid accounts, check the balance, see the realtime-reading status | `DESCO_USERNAME`, `DESCO_PASSWORD` |

Don't see your portal? [Request a connector](https://github.com/bixbd/utils-mcp/issues) or [build one](docs/ADDING_A_CONNECTOR.md).

## Your data and safety

- It runs on your computer. There is no hosted service and no account with us.
- Credentials are read from environment variables you set, and are sent only to the portal over HTTPS.
- Sessions live in memory and are never written to disk. Account numbers are masked in what the AI sees.
- Connectors are unofficial and not affiliated with the portals. Use only accounts you own or may access.

## Contribute

Help is welcome, from a bug report to a whole new connector.

- [How to contribute](CONTRIBUTING.md): ways to help, setup, commit and PR rules.
- [Adding a connector](docs/ADDING_A_CONNECTOR.md): step-by-step guide with the standard and checklist.
- [Releasing](docs/RELEASING.md): for maintainers.

## Repo layout

```
packages/core       defineConnector/defineTool, auth strategies, HTTP client, registry
packages/testkit    Conformance checks, fakePortal, replayFetch
packages/server     The MCP server and CLI (npm: @bixbd/utils-mcp)
connectors/*        One package per portal (npm: @bixbd/utils-mcp-connector-<id>)
tools/*             Generator, repo rules, commit and secret checks, release scripts
docs/               Guides
```

MIT License. Built in the open by [BixBD](https://github.com/bixbd).
