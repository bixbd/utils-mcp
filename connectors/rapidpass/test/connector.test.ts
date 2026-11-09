import { expect, test } from "bun:test";
import { createHttp, createRegistry, envSecrets } from "@bixbd/utils-mcp-core";
import { rapidpass } from "../src";
import { isEmailGate, isLoginPage, parseTravelHistory } from "../src/client";

const loginPage = `<html><body><form method="post" action="/login">
  <input type="hidden" name="csSignature" value="synthetic-signature">
  <input type="hidden" name="_token" value="synthetic-csrf">
  <input type="text" name="email_or_mobile">
  <input type="password" name="password">
  <button id="submit" type="submit">Sign in</button>
</form></body></html>`;

const dashboardHtml = `<main id="pageApp">
  <div class="_rp_card">
    <div class="card-wrapper"><img alt="Card Image"></div>
    <div class="info">
      <p>Name: <span> Rahima Akter </span></p>
      <p>Card Number: <span>RP32A24011604853</span></p>
      <p>Card Status: <span>Active</span></p>
      <p>Balance: <span>৳ 105.00</span></p>
      <a class="info p-0">See Details</a>
    </div>
  </div>
  <div class="_rp_card">
    <div class="card-wrapper"><img alt="Card Image"></div>
    <div class="info">
      <p>Name: <span> Rahima Akter </span></p>
      <p>Card Number: <span>11019842510</span></p>
      <p>Card Status: <span>First Issue Done, Not 2nd Issued Yet</span></p>
      <p>Balance: <span>৳ 14.00</span></p>
      <a class="info p-0">See Details</a>
    </div>
  </div>
</main>`;

const transactionsHtml = `<table>
  <thead><tr><th>SL</th><th>Card Number</th><th>Payment ID</th><th>Payment Time & Date</th><th>Recharge amount</th><th>Payment Status</th><th>Recharge Status</th><th>Refund</th></tr></thead>
  <tbody><tr><td>1</td><td>RP32B24120208157</td><td>SYN-PAY-01</td><td>20-10-2026, 04:15 PM</td><td>500</td><td>Success</td><td>Success</td><td>-</td></tr></tbody>
</table>`;

const transactionsEmpty = `<table>
  <thead><tr><th>SL</th><th>Card Number</th><th>Payment ID</th><th>Payment Time & Date</th><th>Recharge amount</th><th>Payment Status</th><th>Recharge Status</th><th>Refund</th></tr></thead>
  <tbody><tr><td colspan="8">No data found</td></tr></tbody>
</table>`;

const gatedHtml = `<html><body><h1>ইমেইল ভেরিফিকেশন প্রয়োজন!</h1>
  <a href="/user/email-not-verified">Dashboard</a></body></html>`;

const travelHtml = `<!doctype html><html><body><main id="pageApp">
  <div class="_rp_card" @click="handleCardClick({&quot;id&quot;:301,&quot;user_id&quot;:9,&quot;card_number&quot;:&quot;RP32A24011604853&quot;,&quot;hex_card_no&quot;:&quot;SYN-HEX&quot;,&quot;name&quot;:&quot;Rahima Akter&quot;,&quot;phone_number&quot;:&quot;01700000000&quot;,&quot;father_name&quot;:&quot;Karim Mia&quot;,&quot;address&quot;:&quot;Village: Sherpur&quot;,&quot;date_of_birth&quot;:&quot;2000-01-01&quot;,&quot;photo_id_number&quot;:&quot;1990123456789&quot;,&quot;balance&quot;:&quot;105.00&quot;,&quot;server_status&quot;:&quot;ACTIVE&quot;,&quot;sync_status&quot;:&quot;Synced&quot;,&quot;updated_at&quot;:&quot;2026-11-09T12:37:11.000000Z&quot;,&quot;transaction_history&quot;:[{&quot;id&quot;:1,&quot;phone_number&quot;:&quot;01700000000&quot;,&quot;card_number&quot;:&quot;RP32A24011604853&quot;,&quot;service_type&quot;:&quot;Exit (SVC/Discount Not Applicable)&quot;,&quot;origin_station&quot;:&quot;Shewrapara&quot;,&quot;destination_station&quot;:&quot;Mirpur-10&quot;,&quot;spent_amount&quot;:&quot;-18&quot;,&quot;balance&quot;:&quot;105&quot;,&quot;date_stamp&quot;:&quot;2026-01-16&quot;,&quot;time_stamp&quot;:&quot;14:23:02&quot;,&quot;origin_date_stamp&quot;:&quot;2026-01-16&quot;,&quot;origin_time_stamp&quot;:&quot;14:06:15&quot;,&quot;is_penalty&quot;:false,&quot;vehicle_type&quot;:&quot;MRT&quot;},{&quot;id&quot;:2,&quot;card_number&quot;:&quot;RP32A24011604853&quot;,&quot;service_type&quot;:&quot;Recharge&quot;,&quot;origin_station&quot;:&quot;Shewrapara&quot;,&quot;destination_station&quot;:null,&quot;spent_amount&quot;:&quot;200&quot;,&quot;balance&quot;:&quot;339&quot;,&quot;date_stamp&quot;:&quot;2025-11-30&quot;,&quot;time_stamp&quot;:&quot;14:33:22&quot;,&quot;origin_date_stamp&quot;:&quot;2025-11-30&quot;,&quot;origin_time_stamp&quot;:&quot;14:33:22&quot;,&quot;is_penalty&quot;:false,&quot;vehicle_type&quot;:&quot;&quot;}]})">
    <p>Card Number: <span>RP32A24011604853</span></p>
  </div>
</main></body></html>`;
const compactTravelHtml = `<div @click="handleCardClick({&quot;card_number&quot;:&quot;RP32A24011604853&quot;})"></div>`;

const env = { RAPIDPASS_EMAIL: "user@example.com", RAPIDPASS_PASSWORD: "synthetic" };

function runtime(pages: string | string[], envOverride: Record<string, string> = env) {
  const stack = Array.isArray(pages) ? pages : [pages];
  const requests: RequestInit[] = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    requests.push(init ?? {});
    // request 1 is the login page; every later request walks the given pages in order.
    const page = requests.length === 1 ? loginPage : stack[requests.length - 2] ?? stack[stack.length - 1]!;
    return new Response(page, { status: 200, headers: { "set-cookie": "rapidpass_session=synthetic; Path=/" } });
  }) as typeof fetch;
  return { ctx: { account: "default", fetch: fetchImpl, secrets: envSecrets("default", envOverride) }, requests };
}

test("get_cards parses the dashboard grid and masks the card number", async () => {
  const { ctx } = runtime(dashboardHtml);
  const result = await rapidpass.tools.find((t) => t.name === "get_cards")!.run({}, { ...ctx, http: createHttp(rapidpass, ctx) });
  expect(result).toEqual({
    cards: [
      { cardNumber: "RP32A****4853", status: "Active", balanceBdt: "105.00" },
      { cardNumber: "****2510", status: "First Issue Done, Not 2nd Issued Yet", balanceBdt: "14.00" },
    ],
  });
});

test("login submits the CSRF token, csSignature and credentials form-encoded", async () => {
  const { ctx, requests } = runtime(dashboardHtml);
  const result = await rapidpass.tools.find((t) => t.name === "get_cards")!.run({}, { ...ctx, http: createHttp(rapidpass, ctx) });
  expect(result).toBeDefined();
  const login = requests[1]!;
  expect(new Headers(login.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
  const body = new URLSearchParams(String(login.body));
  expect(body.get("_token")).toBe("synthetic-csrf");
  expect(body.get("csSignature")).toBe("synthetic-signature");
  expect(body.get("email_or_mobile")).toBe("user@example.com");
  expect(body.get("password")).toBe("synthetic");
});

test("travel history whitelists operational fields and drops PII", () => {
  const history = parseTravelHistory(travelHtml);
  expect(history).toHaveLength(1);
  expect(history[0]!.cardNumber).toBe("RP32A****4853");
  expect(history[0]!.serverStatus).toBe("ACTIVE");
  expect(history[0]!.syncStatus).toBe("Synced");
  expect(history[0]!.balanceBdt).toBe("105.00");
  expect(history[0]!.lastUpdatedAt).toBe("2026-11-09T12:37:11.000000Z");
  expect(history[0]!.operations).toEqual([
    {
      operationType: "Exit (SVC/Discount Not Applicable)",
      originStation: "Shewrapara", originDate: "2026-01-16", originTime: "14:06:15",
      destinationStation: "Mirpur-10", destinationDate: "2026-01-16", destinationTime: "14:23:02",
      vehicleType: "MRT", isPenalty: false, spentAmountBdt: "-18", balanceBdt: "105",
    },
    {
      operationType: "Recharge",
      originStation: "Shewrapara", originDate: "2025-11-30", originTime: "14:33:22",
      destinationStation: "", destinationDate: "2025-11-30", destinationTime: "14:33:22",
      vehicleType: null, isPenalty: false, spentAmountBdt: "200", balanceBdt: "339",
    },
  ]);
  const serialized = JSON.stringify(history);
  for (const forbidden of ["01700000000", "Rahima Akter", "Karim Mia", "Sherpur", "1990123456789", "2000-01-01", "SYN-HEX"]) {
    expect(serialized.includes(forbidden)).toBe(false);
  }
});

test("a payload without card_number is drift", () => {
  expect(() => parseTravelHistory("<div @click='handleCardClick({&quot;id&quot;:1})'></div>")).toThrow();
  expect(parseTravelHistory(compactTravelHtml)).toEqual([{
    cardNumber: "RP32A****4853", serverStatus: null, syncStatus: null, balanceBdt: null, lastUpdatedAt: null, operations: [],
  }]);
});

test("recharge transaction table parses rows and masks identifiers", async () => {
  const { ctx } = runtime(transactionsHtml);
  const result = await rapidpass.tools.find((t) => t.name === "get_recharge_transactions")!.run({}, { ...ctx, http: createHttp(rapidpass, ctx) });
  expect(result).toEqual({
    tables: [{
      columns: ["SL", "Card Number", "Payment ID", "Payment Time & Date", "Recharge amount", "Payment Status", "Recharge Status", "Refund"],
      rows: [["1", "RP32B****8157", "SYN-PAY-01", "20-10-2026, 04:15 PM", "500", "Success", "Success", "-"]],
    }],
  });
});

test("an empty transaction table is honest, not drift", async () => {
  const { ctx } = runtime(transactionsEmpty);
  const result = await rapidpass.tools.find((t) => t.name === "get_recharge_transactions")!.run({}, { ...ctx, http: createHttp(rapidpass, ctx) });
  expect(result).toEqual({ tables: [{ columns: ["SL", "Card Number", "Payment ID", "Payment Time & Date", "Recharge amount", "Payment Status", "Recharge Status", "Refund"], rows: [] }] });
});

test("unverified accounts get EMAIL_VERIFICATION_REQUIRED, not fake data", async () => {
  const { ctx, requests } = runtime(gatedHtml);
  await expect(rapidpass.tools.find((t) => t.name === "get_recharge_transactions")!.run({}, { ...ctx, http: createHttp(rapidpass, ctx) }))
    .rejects.toMatchObject({ code: "EMAIL_VERIFICATION_REQUIRED" });
  expect(requests.length).toBeGreaterThan(1);
});

test("a bounced session is reported as a credential problem", async () => {
  const { ctx } = runtime(loginPage);
  await expect(rapidpass.tools.find((t) => t.name === "get_cards")!.run({}, { ...ctx, http: createHttp(rapidpass, ctx) }))
    .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
});

test("the portal signals are recognized in both locales", () => {
  expect(isLoginPage(loginPage)).toBe(true);
  expect(isLoginPage(dashboardHtml)).toBe(false);
  expect(isEmailGate(gatedHtml)).toBe(true);
  expect(isEmailGate(dashboardHtml)).toBe(false);
});

test("unfamiliar HTML fails closed", async () => {
  const html = "<html><body>placeholder</body></html>";
  await Promise.all(["get_cards", "get_travel_history", "get_recharge_transactions"].map(async (name) => {
    const { ctx } = runtime(html);
    const result = await createRegistry([rapidpass]).callTool(`rapidpass_${name}`, {}, ctx);
    expect(result.ok).toBe(false);
  }));
});

test("travel parser returns nothing when no pre-rendered history exists", () => {
  expect(parseTravelHistory("<html><body>nothing</body></html>")).toEqual([]);
});
