# NESCO connector (beta)

Unofficial, read-only NESCO prepaid connector, bundled in the MCP server.
Use only meters you own or have permission to access.

Set `NESCO_METER_ID` to your 8–11 digit customer or meter number. No password is
needed for these portal lookups. For another meter set `NESCO_METER_ID__OFFICE`
and call with `account: "office"`.

Tools: `nesco_get_meter_status`, `nesco_get_recharge_history` and `nesco_get_monthly_usage`.
History tools return tables as columns and rows, with long numeric identifiers
masked. `nesco_get_meter_status` returns balance, reading timestamp, tariff and
meter state only — names, addresses, mobiles and numeric identifiers never leave
the portal page. An unrecognized response fails rather than inventing an empty
history, and the portal's silent "unknown number" page maps to `NOT_FOUND`
instead of drift.

## Observed portal flow (2026-11-09)

[The former prepaid portal](https://prepaid.nesco.gov.bd/) redirects to
[the customer portal](https://customer.nesco.gov.bd/pre/panel).
GET `/pre/panel` establishes session cookies and provides a hidden `_token` in
`form#customer-form`. POST the same path as URL-encoded `_token`, `cust_no`, and
`submit`, with value `রিচার্জ হিস্ট্রি` or `মাসিক ব্যবহার`. These POSTs are read-only
queries. Cookies stay in memory; a fresh CSRF token is read for every lookup.

The form and submit values were inspected live with ego-browser. No authorized
meter was available: successful account HTML is **not verified**, and tests use
synthetic tables. `verifiedWithLiveAccount: false` makes that limitation explicit.
The parser deliberately rejects pages without a recognizable dated history table.
A valid empty history may therefore require manual checking. No balance endpoint,
PDF download, token retrieval, account registration or payment is exposed.
