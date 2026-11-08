# @bixbd/utils-mcp-core

The building blocks for [utils-mcp](https://github.com/bixbd/utils-mcp) connectors. Beta.

You do not need this package to use utils-mcp. Install it only when writing a connector.

```ts
import { defineConnector, defineTool, noAuth, z } from "@bixbd/utils-mcp-core";
```

- `defineConnector` and `defineTool` describe a portal and its task-shaped tools. Read, write and destructive tools get the right MCP annotations.
- Auth strategies: no auth, API key, bearer token and form login with CSRF.
- A small HTTP client with an in-memory session, one re-login on 401, and clear errors when the portal changes.
- `maskLast4` and secret helpers for multiple accounts.

Start from `bun run new:connector <id>` in the [repository](https://github.com/bixbd/utils-mcp) and read [CONTRIBUTING.md](https://github.com/bixbd/utils-mcp/blob/main/CONTRIBUTING.md). MIT License.
