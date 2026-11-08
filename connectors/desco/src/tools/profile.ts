import { accountGet } from "./factories";

/** Who the account is and which office serves it, signed in. */
export const profileTools = [
  accountGet(
    "get_account_summary",
    "Summary of a DESCO prepaid account: customer, meter and connection details.",
    "/summary",
  ),
  accountGet(
    "get_contact_office",
    "The DESCO office that serves this account: name, address and phone.",
    "/contact-office",
  ),
];
