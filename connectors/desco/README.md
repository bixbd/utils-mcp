# desco connector

Unofficial connector for the DESCO prepaid electricity portal (https://prepaid.desco.org.bd/).
Follows the flow documented in [KhBayazidAhmed/desco-prepaid-api](https://github.com/KhBayazidAhmed/desco-prepaid-api).

Use only accounts you own or have permission to access. Not affiliated with DESCO.

## Tools

| Tool | What it does |
| --- | --- |
| `desco_list_accounts` | Linked accounts with their `accountId` (numbers masked to the last 4 digits) |
| `desco_get_balance` | Daily balance in BDT. `accountId` is optional when only one account is linked |
| `desco_get_realtime_status` | Last realtime-reading result and eligibility. Does not request a new reading |

All tools are read-only. The balance is a daily snapshot, and an unavailable balance is flagged, never reported as zero.

## Credentials

Set these in the MCP server environment. They stay on your machine and are sent only to DESCO over HTTPS.

```
DESCO_USERNAME=...
DESCO_PASSWORD=...
```

For a second account, use the label suffix and pass `account: "office"` in the tool call:

```
DESCO_USERNAME__OFFICE=...
DESCO_PASSWORD__OFFICE=...
```

Claude Desktop example:

```json
{
  "mcpServers": {
    "utils": {
      "command": "bunx",
      "args": ["@bixbd/utils-mcp"],
      "env": { "DESCO_USERNAME": "...", "DESCO_PASSWORD": "..." }
    }
  }
}
```

## Behavior

- Logs in on first use (CSRF cookie, then login) and keeps cookies in memory only.
- If the session expires, it logs in once more. A rejected login is never retried.
- Not implemented yet: requesting a new realtime reading (the portal flow is source-inspected only), recharge history.
