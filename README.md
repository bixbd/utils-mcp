# utils-mcp

An open project to connect utility portals with AI agents through the Model Context Protocol (MCP).

## Why we're building this

Useful tools are scattered across websites and portals. Finding the right one and using it often means switching between sites and repeating manual steps. **utils-mcp** brings them together and gives AI agents a consistent way to use them.

## Status

Beta. The server, connector standard, test kit and the DESCO connector are published to npm under the `next` tag. More connectors are coming.

## How it works

- **Connectors** expose a few task-shaped tools each (`<connector>_<verb>_<noun>`), with read/write annotations, typed input, and errors that tell the AI how to fix the problem.
- **Config** decides which connectors are enabled, so the AI's tool list stays small.
- **Runs locally** over stdio with Bun. Credentials stay on your machine.

## Repo layout

```
packages/core       defineConnector/defineTool, auth strategies, HTTP client, registry
packages/testkit    Conformance checks, fakePortal, replayFetch
packages/server     The MCP server and CLI (published as @bixbd/utils-mcp)
tools/scaffold      `new:connector` generator and `check:connectors` repo rules
connectors/example  Reference connector (pattern to follow)
connectors/desco    DESCO prepaid electricity: accounts and balance (see its README)
```

## Develop

```bash
bun install        # also installs the Husky git hooks
bun run lint       # Oxlint
bun run typecheck  # tsc via Turborepo
bun run check:connectors  # repo rules lint can't express
bun run test       # bun test via Turborepo
```

Git hooks: `pre-commit` runs lint-staged (Oxlint) and typecheck; `pre-push` runs the tests.

## Add a connector

```bash
bun run new:connector acme-portal
```

Then follow [CONTRIBUTING.md](CONTRIBUTING.md). The server loads enabled connectors by name, so there is nothing to register.

## Use it with Claude

Beta packages are on npm under the `next` tag. Install the server and the connectors you need into one folder:

```bash
mkdir -p ~/.utils-mcp && cd ~/.utils-mcp
bun add @bixbd/utils-mcp@next @bixbd/utils-mcp-connector-desco@next
echo '{ "enabled": ["desco"] }' > config.json
```

Then add it to your AI app with the full path and your credentials. Full setup for Claude Desktop and Claude Code, multiple accounts and troubleshooting are in the [server README](packages/server/README.md).

From a checkout: `"command": "bun", "args": ["/path/to/utils-mcp/packages/server/src/cli.ts"]`.

## Connectors

| Connector | Tools | Auth |
| --- | --- | --- |
| `example` | `example_get_status` | none |
| `desco` | `desco_list_accounts`, `desco_get_balance`, `desco_get_realtime_status` | `DESCO_USERNAME`, `DESCO_PASSWORD` env vars |

Nothing is enabled by default. Enable connectors in `~/.utils-mcp/config.json`, for example `{ "enabled": ["desco"] }`. Each connector is its own package (`@bixbd/utils-mcp-connector-<id>`) loaded on demand. Credentials are read from the server's environment. For a second account, add the suffix `__LABEL` (for example `DESCO_USERNAME__OFFICE`) and pass `account: "office"` in the tool call.

## Contribute

Have a utility portal you'd like your agents to access? [Open an issue](https://github.com/bixbd/utils-mcp/issues) with the portal's name and URL, what it helps you do, an example task, and any API docs or access requirements.

---

MIT License. Built in the open by [BixBD](https://github.com/bixbd).
