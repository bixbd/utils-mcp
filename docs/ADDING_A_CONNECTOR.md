# Adding a connector

A connector is a small folder in `connectors/` that describes one portal: where it lives, how to sign in, and a few task-shaped tools. The core handles login, sessions, retries, error mapping and validation, so keep connectors thin. About an hour of work is typical.

## Before you start

- Check the [open issues](https://github.com/bixbd/utils-mcp/issues) so nobody else is building it. Opening an issue first is welcome.
- You need an account on the portal and permission to use it. Do not build connectors for accounts you don't own or for services that forbid automation.
- Work out the portal's flow with your browser's network tab: the login request, what cookies or tokens it sets, and the requests behind the pages you care about.

## 1. Generate the connector

```bash
bun install
bun run new:connector acme-portal
bun install
```

The id is lowercase kebab-case. This creates `connectors/acme-portal` with source, tests and a README. Connectors are not published on their own. Once it is merged, a maintainer adds it to the server's built-in list (`packages/server/src/bundled.ts`) and its dependencies, so users get it from the one `@bixbd/utils-mcp` package.

## 2. Describe the portal and sign-in

Open `connectors/acme-portal/src/index.ts`. Pick the auth that matches the portal:

| Auth | Use when | Example |
| --- | --- | --- |
| `noAuth()` | Public endpoints | `auth: noAuth()` |
| `apiKey(...)` | A key in a header | header name plus the name of the environment variable that holds the key |
| `bearer(...)` | A bearer token | the name of the environment variable that holds the token |
| `formLogin({...})` | Username and password, session cookies, optional CSRF | see [`desco`](../connectors/desco/src/index.ts) |

Secret names become environment variables. For a second account, users add `__LABEL`, for example `ACME_API_KEY__OFFICE`, and the AI passes `account: "office"`.

## 3. Write the tools

Each tool is something a person would ask for, not one endpoint.

```ts
defineTool({
  name: "get_balance",                // verb_noun, exposed as acme_get_balance
  description: "Get the current balance. Use when asked how much credit is left.",
  access: "read",                     // read | write | destructive
  input: z.object({ accountId: z.string().optional() }),
  output: z.object({ balance: z.number(), currency: z.string() }),
  handler: async (input, ctx) => {
    const raw = await ctx.http.json("/balance", RawBalance);
    return { balance: raw.balance, currency: "BDT" };
  },
});
```

Declare only the upstream fields you use in a zod schema (`RawBalance` above). If the portal changes, the tool fails loudly with `UPSTREAM_CHANGED` instead of returning wrong data.

## 4. Test it

Cover success, a changed upstream shape, an HTTP error, and missing credentials.

- `fakePortal` simulates a site with login, cookies, CSRF and session expiry.
- `replayFetch` replays saved responses for simple requests.
- Save fixtures with every real name, number, balance, cookie and token removed.

```bash
bun run check
```

`bun run check` runs lint, the connector rules, the typecheck and all tests. Run it before every push.

## 5. Write the README

`connectors/acme-portal/README.md` should say what the connector is, list the tools, name the credentials (environment variables), and note quirks. Copy the [DESCO README](../connectors/desco/README.md) as a model. Say clearly if it is unofficial.

## 6. Open a pull request

Follow [CONTRIBUTING.md](../CONTRIBUTING.md): a branch, [Conventional Commits](https://www.conventionalcommits.org) such as `feat(acme-portal): add balance tool`, and the PR template. CI runs the same checks as your machine. Maintainers bundle new connectors into `@bixbd/utils-mcp` in the next release.

## The standard

CI enforces most of this.

**Tools**
- 3 to 6 tools per connector, shaped around tasks.
- Names are `verb_noun`. Descriptions say what the tool does and when to use it, written for the AI.
- Tools return small, typed JSON, never raw HTML or whole upstream payloads.
- Errors tell the AI what to do next: `throw new UtilsError(code, message, hint)`.
- Anything that changes data is `write`. Anything that deletes or spends is `destructive`.

**Safety and privacy**
- Mask account, meter and card numbers with `maskLast4`. Never log or return secrets.
- Credentials come from the auth strategy or `ctx.secrets`, never `process.env`.
- Never retry a rejected login.
- Respect rate limits. Don't enumerate IDs.

**Code**
- Call the portal with `ctx.http.json(path, schema)`, never `fetch`.
- Connectors never import other connectors.

## Review checklist

- [ ] `bun run check` passes
- [ ] Tools are task-shaped and described for the AI
- [ ] Access levels are right (`read`, `write`, `destructive`)
- [ ] Sensitive values are masked and fixtures are redacted
- [ ] README lists the credentials and says it is unofficial
