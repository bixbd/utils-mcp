# Connector standard

Every portal is a **connector**: a small package that declares the portal, its auth, and a few task-shaped tools. The core handles login, sessions, retries, error mapping and validation. Keep connectors thin.

## Add a connector

```bash
bun run new:connector acme-portal   # generates connectors/acme-portal
bun install
# edit connectors/acme-portal/src/index.ts, save real redacted responses in fixtures/
bun run test && bun run check:connectors && bun run lint
```

Enable it in `~/.utils-mcp/config.json` (`{ "enabled": ["acme-portal"] }`). The server loads `@bixbd/utils-mcp-connector-<id>` on demand, so nothing in the server changes.

## What a connector looks like

```ts
export const acme = defineConnector({
  id: "acme",
  version: "0.1.0",
  status: "beta",                      // active | beta | broken | deprecated
  description: "One line about the portal",
  baseUrl: "https://portal.example.com/api",
  auth: formLogin({ ... }),            // or apiKey, bearer, noAuth
  tools: [
    defineTool({
      name: "get_balance",             // verb_noun, snake_case. Exposed as acme_get_balance
      description: "What it does and when to use it.",
      access: "read",                  // read | write | destructive
      input: z.object({ ... }),
      output: z.object({ ... }),
      handler: async (input, ctx) => {
        const raw = await ctx.http.json("/balance", RawBalance); // validates the upstream shape
        return { ... };                // only what the AI needs
      },
    }),
  ],
});
export default acme;
```

## Rules (CI enforces most of them)

**Tools**
- 3 to 6 tools per connector, shaped around tasks, not one per endpoint.
- Names are `verb_noun`. Descriptions say what the tool does and when to use it, written for the AI.
- Tools return small, typed JSON. Never raw HTML or whole upstream payloads.
- Errors tell the AI the next step. Throw `UtilsError(code, message, hint)`.
- Anything that changes data is `write`. Anything that deletes or spends is `destructive`.

**Safety and privacy**
- Mask account, meter and card numbers (`maskLast4`). Never log or return secrets.
- Credentials come from `ctx.secrets` or an auth strategy, never `process.env`.
- Never retry a rejected login.
- Use only accounts the user owns or may access. Respect rate limits. Don't enumerate IDs.

**Code**
- Call the portal with `ctx.http.json(path, schema)`, never `fetch`.
- Describe only the upstream fields you use in a zod schema, so a portal change fails loudly (`UPSTREAM_CHANGED`) instead of returning wrong data.
- Connectors never import other connectors.

**Tests**
- Cover success, drift, an HTTP error, and missing credentials.
- Use `fakePortal` for flows (login, expiry) and `replayFetch` with saved responses for simple GETs.
- Fixtures must be redacted: no real names, numbers, balances, cookies or tokens.

**Docs**
- `README.md` per connector: what it is, tools, credentials (env var names), known quirks.

## Review checklist

- [ ] `bun run lint`, `bun run typecheck`, `bun run test`, `bun run check:connectors` pass
- [ ] Tools are task-shaped and described for the AI
- [ ] Access levels are right (`read` / `write` / `destructive`)
- [ ] Sensitive values are masked, fixtures are redacted
- [ ] README lists the credentials
