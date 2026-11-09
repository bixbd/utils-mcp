# utils-mcp

Let your AI assistant use everyday utility portals for you. Ask in plain language, get the answer, and keep your credentials on your own computer.

> **Beta.** Published on npm under the `next` tag. More connectors are coming.

> "What's my DESCO prepaid balance?"

utils-mcp is a local [MCP](https://modelcontextprotocol.io) server. Each utility portal is a small **connector** that gives your AI a few clear tools. You turn on only the connectors you need.

## Quick start

**Claude Desktop, no terminal:** download `utils-mcp.mcpb` from the [latest release](https://github.com/bixbd/utils-mcp/releases), double-click it, click **Install**, and enter your DESCO login in the form. Your password is kept in your computer's secure keychain. Then ask: "What's my DESCO prepaid balance?"

**Any other AI app (2 steps):** you need [Node.js](https://nodejs.org) 18 or newer (the normal installer is fine) and any AI app that supports MCP.

**1. Run the setup**

```bash
npx -y @bixbd/utils-mcp@next setup
```

It asks for your portal login, finds your AI apps (Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, Gemini CLI) and adds itself to them. Nothing else to install or edit.

**2. Restart your AI app** and ask: "What's my DESCO prepaid balance?"

### Another AI app, or you prefer to do it by hand

Any app that can run an MCP server works. Add this to its MCP settings (the format is the same everywhere):

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

Claude Code: `claude mcp add utils -e DESCO_USERNAME=your-username -e DESCO_PASSWORD=your-password -- npx -y @bixbd/utils-mcp@next`

Several accounts per portal, choosing connectors, and troubleshooting are in the [server guide](packages/server/README.md).

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
packages/server     The MCP server and CLI. The only npm package: @bixbd/utils-mcp
packages/core       defineConnector/defineTool, auth strategies, HTTP client (bundled, not published)
packages/testkit    Conformance checks, fakePortal, replayFetch (dev only)
connectors/*        One folder per portal, bundled into the server (not published)
tools/*             Generator, repo rules, commit and secret checks, release scripts
docs/               Guides
```

Everything ships as one npm package, `@bixbd/utils-mcp`. The other folders are workspaces used for development.

MIT License. Built in the open by [BixBD](https://github.com/bixbd).

NESCO prepaid (beta): set `NESCO_METER_ID` to an authorized 8–11 digit meter or customer number. Tools: `nesco_get_meter_status`, `nesco_get_recharge_history`, `nesco_get_monthly_usage`. Successful account responses remain unverified; see [connector documentation](https://github.com/bixbd/utils-mcp/tree/main/connectors/nesco).
RapidPass smart card (beta): set `RAPIDPASS_COOKIES` (cookie header from a logged-in browser; safest) or `RAPIDPASS_EMAIL`/`RAPIDPASS_PASSWORD`. Tools: `rapidpass_get_cards`, `rapidpass_get_travel_history`, `rapidpass_get_recharge_transactions` (the last needs a verified email); see [connector documentation](https://github.com/bixbd/utils-mcp/tree/main/connectors/rapidpass).
