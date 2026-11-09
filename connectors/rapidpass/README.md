# RapidPass connector (beta)

Unofficial, read-only connector for [RapidPass](https://rapidpass.com.bd) — the DTCA
smart card used on Dhaka's Metro Bus Rapid Transit, BRTA buses and metro rail.
Use only accounts you own or have permission to access.

## Credentials

Two ways to authenticate, in order of preference:

1. **Cookie import (recommended).** The login page sits behind reCAPTCHA
   Enterprise, and its risk engine can silently reject scripted credential
   logins. Copy the `Cookie` request header from a logged-in browser
   (developer tools → network → any rapidpass.com.bd request) into:

   | Secret | Meaning |
   |---|---|
   | `RAPIDPASS_COOKIES` | Raw cookie header, e.g. `XSRF-TOKEN=…; rapidpass_session=…` |

   Sessions expire when the portal logs you out; refresh the secret then.

2. **Credentials.** Works only when the portal's risk engine is benign:

   | Secret | Meaning |
   |---|---|
   | `RAPIDPASS_EMAIL` | The email or mobile number of your rapidpass.com.bd account |
   | `RAPIDPASS_PASSWORD` | The account password |

Optional `"user"` account suffixes work as with every other connector.
Requests carry a browser-shaped User-Agent either way; Laravel sessions are
bound to the agent, and `htmlFormLogin` sends Origin/Referer on the POST.

## Tools

- `rapidpass_get_cards` — registered cards with number, status and balance.
  Card numbers are masked (`RP32A****4853`).
- `rapidpass_get_travel_history` — per-card gate history as the operator uploaded
  it (operation type, origin/destination station + time, amount, balance after
  the operation). The portal notes that history appears only after the operator
  submits data; the website shows no live balance.
- `rapidpass_get_recharge_transactions` — online top-up payment rows. The portal
  gates this behind email verification: an unverified account receives
  `EMAIL_VERIFICATION_REQUIRED` instead of data.

Rows keep the portal's signs: travel amounts are negative, recharges positive.
