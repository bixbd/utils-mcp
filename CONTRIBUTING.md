# Contributing to utils-mcp

Thanks for helping. Every kind of contribution counts.

## Ways to help

- **Request a connector.** [Open an issue](https://github.com/bixbd/utils-mcp/issues) with the portal's name and URL, what it helps you do, an example task, and any API docs or access requirements.
- **Report a bug.** Include the connector, the tool, what you asked, and what happened. Never paste real credentials, tokens or account numbers.
- **Build a connector.** Follow [docs/ADDING_A_CONNECTOR.md](docs/ADDING_A_CONNECTOR.md).
- **Improve docs, tests or the core.** Small focused pull requests are easiest to review.

## Set up

You need [Bun](https://bun.sh) 1.1 or newer.

```bash
git clone https://github.com/bixbd/utils-mcp && cd utils-mcp
bun install            # also installs the Git hooks
bun run check          # lint, connector rules, typecheck and tests
```

Useful commands:

| Command | What it does |
| --- | --- |
| `bun run check` | Everything CI runs |
| `bun run lint` / `lint:fix` | Oxlint |
| `bun run typecheck` | `tsc` with strict flags |
| `bun run test` | `bun test` with per-file coverage thresholds |
| `bun run check:connectors` | Repo rules lint can't express |
| `bun run new:connector <id>` | Generate a connector |

## Workflow

1. Fork the repo (or branch if you have access) and create a branch from `main`.
2. Make a focused change with tests.
3. Run `bun run check`.
4. Open a pull request using the template. CI must pass.

Never push directly to `main`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

```
feat(desco): add realtime status
fix(core): stop retrying a rejected login
```

## Git hooks

Installed by `bun install`. They run the same checks as CI, so problems show up before you push.

| Hook | Runs |
| --- | --- |
| `pre-commit` | Oxlint on staged files, secret scan, typecheck |
| `commit-msg` | Conventional Commits check |
| `pre-push` | `bun run check` |

The secret scan blocks things that look like keys or tokens. If a finding is a harmless test value, add `guard:allow-secret` on that line.

## Code rules

- TypeScript strict mode, Oxlint with warnings as errors, no `any`.
- One file is at most 250 lines, blanks and comments included. Oxlint enforces it (`max-lines`) in lint, the pre-commit hook and CI. Split by responsibility instead of squeezing.
- Tests are required. Each file must keep at least 80% line and function coverage.
- Connectors only talk to portals through `ctx.http`, never `fetch`, and never read `process.env` directly.
- Never commit credentials, real account data, cookies or tokens. Fixtures must be redacted.

## Security

Report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
