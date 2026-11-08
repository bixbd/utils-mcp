# example connector

Reference connector for the connector standard. It talks to a fictional portal and exists to be copied.
To start a real one, run `bun run new:connector <name>` instead of copying by hand.

## Tools

| Tool | What it does |
| --- | --- |
| `example_get_status` | Current service status of the example portal |

## Credentials

None.

## Notes

- Shows the pattern: declare the portal and auth, then per tool declare input, output, and a handler that calls `ctx.http.json`.
- Tests replay a saved response from `fixtures/status.json`.
