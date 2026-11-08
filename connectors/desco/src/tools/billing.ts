import { accountGet, dateInput } from "./factories";

/** Recharges and tokens, signed in. */
export const billingTools = [
  accountGet("get_recharge_history", "Recharge transactions for a date range (YYYY-MM-DD).", "/transactions", {
    dateFrom: dateInput,
    dateTo: dateInput,
  }),
  accountGet(
    "get_token_history",
    "Recharge tokens issued for a date range (YYYY-MM-DD). Tokens are credentials for the meter, so share them only with the account owner.",
    "/tokens",
    { dateFrom: dateInput, dateTo: dateInput },
  ),
  accountGet(
    "get_token_resend_eligibility",
    "Whether a recharge token can be re-sent for this account. Does not send anything.",
    "/token-resend/eligibility",
  ),
];
