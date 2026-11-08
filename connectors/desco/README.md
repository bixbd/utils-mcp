# desco connector

> Beta. Built into [@bixbd/utils-mcp](https://www.npmjs.com/package/@bixbd/utils-mcp). It is not published as its own package.

Unofficial connector for the DESCO prepaid electricity portal (https://prepaid.desco.org.bd/).
Follows the flow documented in [KhBayazidAhmed/desco-prepaid-api](https://github.com/KhBayazidAhmed/desco-prepaid-api).

Use only accounts you own or have permission to access. Not affiliated with DESCO.

## Tools

| Tool | What it does |
| --- | --- |
| `desco_list_accounts` | Linked accounts with their `accountId` (numbers masked to the last 4 digits) |
| `desco_get_balance` | Daily balance in BDT. `accountId` is optional when only one account is linked |
| `desco_get_realtime_status` | Last realtime-reading result and eligibility. Does not request a new reading |
| `desco_get_account_summary` | Customer, meter and connection summary |
| `desco_get_daily_usage` / `desco_get_monthly_usage` | Usage over a date or month range |
| `desco_get_consumption_comparison` | Monthly consumption compared across years |
| `desco_get_energy_vs_consumed_taka` | kWh versus BDT per month |
| `desco_get_recharge_history` / `desco_get_token_history` | Recharge transactions and issued tokens |
| `desco_get_token_resend_eligibility` | Whether a token can be re-sent. Sends nothing |
| `desco_get_contact_office` | Serving DESCO office and phone |
| `desco_get_tariff` | Current retail tariff slabs and rates |
| `desco_list_notices`, `desco_list_faqs`, `desco_list_short_codes` | Portal notices, FAQ, meter keypad codes |
| `desco_find_recharge_points`, `desco_list_recharge_point_filters` | Recharge shops by bank and area |
| `desco_find_meter_manuals`, `desco_find_tutorials` | Meter manuals and video tutorials |
| `desco_list_tariff_documents`, `desco_list_documents` | Tariff orders, circulars, forms, policies |

All tools are read-only. The balance is a daily snapshot, and an unavailable balance is flagged, never reported as zero.

## Code layout

```
src/
  index.ts        connector definition only (id, auth, tool list)
  client/         talking to the portal: account lookup, query strings, redaction
  schemas/        raw (upstream) and out (what the AI sees) shapes
  tools/          one file per topic: accounts, profile, usage, billing, info, directory
    factories.ts  publicGet, publicSearch, accountGet helpers
test/
  portal.ts       fake DESCO portal and run helper shared by the tests
```

To add a tool, put it in the matching `tools/` file (or a new one) and register it in `tools/index.ts`. No file may pass 250 lines.

## Install

Nothing extra to install. The connector ships inside `@bixbd/utils-mcp` and turns on when `DESCO_USERNAME` and `DESCO_PASSWORD` are set. See the [server README](https://www.npmjs.com/package/@bixbd/utils-mcp) for the Claude Desktop and Claude Code setup.

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

Put them in the `env` block of your MCP server config, as shown in the server README.

## Behavior

- Logs in on first use (CSRF cookie, then login) and keeps cookies in memory only.
- If the session expires, it logs in once more. A rejected login is never retried.
- Public tools were checked against the live portal. Signed-in tools (usage, recharges, tokens, summary) were mapped from the portal's JS bundle and return the portal's data as-is, with account and meter numbers masked, because their response shapes are not verified yet.
- Not exposed (they change state): requesting a realtime reading, re-sending a token, linking an account, profile and password changes.
- Every tool signs in first, including the public ones.

MIT License. Source and issues: https://github.com/bixbd/utils-mcp
