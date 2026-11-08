# utils-mcp

An open project to connect utility portals with AI agents through the Model Context Protocol (MCP).

## Why we're building this

Useful tools are scattered across websites and portals. Finding the right one and using it often means switching between sites and repeating manual steps. **utils-mcp** brings them together and gives AI agents a consistent way to use them.

## Status

Early scaffold. The monorepo, connector standard, test kit and one reference connector exist. Real portal connectors come next.

## How it works

- **Connectors** expose a few task-shaped tools each (`<connector>_<verb>_<noun>`), with read/write annotations, typed input, and errors that tell the AI how to fix the problem.
- **Config** decides which connectors are enabled, so the AI's tool list stays small.
- **Runs locally** over stdio with Bun. Credentials stay on your machine.

## Repo layout

```
packages/core       Connector types, errors, registry, input validation
packages/testkit    Conformance checks and an offline fetch replayer
packages/server     The MCP server and CLI (published as @bixbd/utils-mcp)
connectors/example  Reference connector. Copy it to add a new one
connectors/desco    DESCO prepaid electricity: accounts and balance (see its README)
```

## Develop

```bash
bun install        # also installs the Husky git hooks
bun run lint       # Oxlint
bun run typecheck  # tsc via Turborepo
bun run test       # bun test via Turborepo
```

Git hooks: `pre-commit` runs lint-staged (Oxlint) and typecheck; `pre-push` runs the tests.

## Add a connector

1. Copy `connectors/example` to `connectors/<name>`.
2. Rename the package and the connector `id`.
3. Save real portal responses in `fixtures/` and test against them with `replayFetch`.
4. Make sure `checkConformance(connector)` returns no problems.
5. Register it in `packages/server/src/connectors.ts`.

## Use it with Claude

Create `~/.utils-mcp/config.json`:

```json
{ "enabled": ["example"] }
```

Then add the server (once published to npm):

```json
{
  "mcpServers": {
    "utils": { "command": "bunx", "args": ["@bixbd/utils-mcp"] }
  }
}
```

From a checkout: `"command": "bun", "args": ["/path/to/utils-mcp/packages/server/src/cli.ts"]`.

## Connectors

| Connector | Tools | Auth |
| --- | --- | --- |
| `example` | `example_get_status` | none |
| `desco` | `desco_list_accounts`, `desco_get_balance`, `desco_get_realtime_status` | `DESCO_USERNAME`, `DESCO_PASSWORD` env vars |

Enable connectors in `~/.utils-mcp/config.json`, for example `{ "enabled": ["desco"] }`. Credentials are read from the server's environment. For a second account, add the suffix `__LABEL` (for example `DESCO_USERNAME__OFFICE`) and pass `account: "office"` in the tool call.

## Contribute

Have a utility portal you'd like your agents to access? [Open an issue](https://github.com/bixbd/utils-mcp/issues) with the portal's name and URL, what it helps you do, an example task, and any API docs or access requirements.

---

Built in the open by [BixBD](https://github.com/bixbd).
