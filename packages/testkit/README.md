# @bixbd/utils-mcp-testkit

Test tools for [utils-mcp](https://github.com/bixbd/utils-mcp) connector authors. Beta. Use as a dev dependency.

- `checkConformance(connector)` returns the list of rules a connector breaks, such as naming and metadata.
- `fakePortal` is an in-process fake website with cookies, CSRF and sessions, so tests never touch the real portal.
- `replayFetch` replays recorded responses.

```ts
import { checkConformance, fakePortal } from "@bixbd/utils-mcp-testkit";
```

See the [DESCO connector tests](https://github.com/bixbd/utils-mcp/tree/main/connectors/desco/test) for an example. MIT License.
