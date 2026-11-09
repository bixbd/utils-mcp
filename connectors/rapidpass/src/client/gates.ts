import { load } from "cheerio";
import { UtilsError } from "@bixbd/utils-mcp-core";

/** The portal answered, but the markup matches nothing we recognize. */
export const changedPage = () => new UtilsError(
  "UPSTREAM_CHANGED",
  "Rapid Pass returned an unrecognized page",
  "Check rapidpass.com.bd manually; its HTML may have changed.",
);

/** Gated pages answer with the email-verification banner instead of data. */
export const unverifiedEmail = () => new UtilsError(
  "EMAIL_VERIFICATION_REQUIRED",
  "Rapid Pass account email is not verified",
  "Sign in on rapidpass.com.bd and verify the email (an OTP arrives by mail), then retry.",
);

/** The session got bounced; the stored credentials no longer work. */
export const rejectedCredentials = () => new UtilsError(
  "AUTH_REQUIRED",
  "Rapid Pass rejected the credentials",
  "Fix RAPIDPASS_EMAIL / RAPIDPASS_PASSWORD and restart the server.",
);

/** True when the session got bounced back to the login form. */
export function isLoginPage(html: string): boolean {
  return load(html)(`input[name="email_or_mobile"]`).length > 0;
}

/** True when a gated page answered with the email-verification banner. */
export function isEmailGate(html: string): boolean {
  const $ = load(html);
  const bannerHref = $("[src*='email-not-verified'], a[href*='email-not-verified']").length > 0;
  const bannerText = (/ইমেইল ভেরিফিকেশন|verify your email/i).test($.text());
  return bannerHref || bannerText;
}
