import { expect, test } from "bun:test";
import { createHttp, createRegistry, envSecrets } from "@bixbd/utils-mcp-core";
import { nesco } from "../src";
import { hasResult, parseHistory, parseProfile } from "../src/client";

const form = '<form id="customer-form"><input name="_token" value="synthetic-csrf"></form>';
const table = '<table><tr><th>Date</th><th>Amount</th><th>Meter</th></tr><tr><td>2026-01-01</td><td>500</td><td>00000001</td></tr></table>';
function runtime(html = table, status = 200, env: Record<string, string> = { NESCO_METER_ID: "00000001" }) {
  const requests: RequestInit[] = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    requests.push(init ?? {});
    if (init?.method === "POST") {
      expect(new Headers(init.headers).get("cookie")).toBe("session=synthetic");
      expect(new Headers(init.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
      expect(new URLSearchParams(String(init.body)).get("_token")).toBe("synthetic-csrf");
      return new Response(html, { status });
    }
    return new Response(form, { headers: { "set-cookie": "session=synthetic; Path=/" } });
  }) as typeof fetch;
  return { ctx: { account: "default", fetch: fetchImpl, secrets: envSecrets("default", env) }, requests };
}

for (const [tool, action] of [["get_recharge_history", "রিচার্জ হিস্ট্রি"], ["get_monthly_usage", "মাসিক ব্যবহার"]] as const) {
  test(`${tool} sends the form with cookies and masks identifiers`, async () => {
    const { ctx, requests } = runtime();
    const result = await nesco.tools.find((t) => t.name === tool)!.run({}, { ...ctx, http: createHttp(nesco, ctx) });
    expect(result).toEqual({ meterLast4: "0001", tables: [{ columns: ["Date", "Amount", "Meter"], rows: [["2026-01-01", "500", "****0001"]] }], verifiedWithLiveAccount: false });
    expect(new URLSearchParams(String(requests[1]?.body)).get("submit")).toBe(action);
  });
}

test("missing and invalid meter IDs never call the portal", async () => {
  await Promise.all([{}, { NESCO_METER_ID: "invalid" }].map(async (env) => {
    const { ctx, requests } = runtime(table, 200, env);
    await expect(nesco.tools[0]!.run({}, { ...ctx, http: createHttp(nesco, ctx) })).rejects.toThrow();
    expect(requests).toHaveLength(0);
  }));
});

test("HTTP errors and unfamiliar HTML fail closed", async () => {
  await Promise.all(([ ["unrecognized", 200], [table, 503] ] as const).map(async ([html, status]) => {
    const { ctx } = runtime(html, status);
    const result = await createRegistry([nesco]).callTool("nesco_get_recharge_history", {}, ctx);
    expect(result.ok).toBe(false);
  }));
});

test("missing CSRF and malformed rows are rejected", async () => {
  const { ctx } = runtime();
  await expect(nesco.tools[0]!.run({}, { ...ctx, http: { text: async () => "no form", json: async () => { throw new Error(); } } })).rejects.toThrow("unrecognized");
  expect(() => parseHistory('<table><tr><th>Date</th><th>Amount</th></tr><tr><td>January</td></tr></table>')).toThrow();
  expect(() => parseHistory('<table><tr><th>Name</th></tr></table>')).toThrow();
  expect(parseHistory('<table><tr><th>মাস</th></tr></table>')).toEqual([{ columns: ["মাস"], rows: [] }]);
});

// The portal's profile grid: Bengali label → sibling div → disabled value input.
// Synthetic values throughout; the live field order may differ, the label walk must not care.
function grid(entries: [label: string, value: string][]) {
  return entries.map(([label, value]) =>
    `<div class="form-group row"><div class="col-md-3"><label>${label}</label></div><div><input type="text" disabled value="${value}"></div></div>`
  ).join("");
}

const profileHtml = `${form}${grid([
  ["গ্রাহকের নাম", "Karim Mia"],
  ["ঠিকানা", "Village: Sherpur, Bogura"],
  ["মোবাইল", "01700000000"],
  ["সংশ্লিষ্ট বিদ্যুৎ অফিস", "Bogura S&D 1"],
  ["ফিডারের নাম", "Feeder 04"],
  ["কনজ্যুমার নম্বর", "24561098"],
  ["মিটার নম্বর", "11019842510"],
  ["অনুমোদিত লোড (কি.ও)", "2"],
  ["অনুমোদিত ট্যারিফ", "LT-A"],
  ["মিটারের ধরণ", "Single-Phase"],
  ["মিটার স্ট্যাটাস", "Active"],
  ["মিনিমাম রিচার্জের পরিমাণ (টাকা)", "50"],
  ["অবশিষ্ট ব্যালেন্স (টাকা) (সময়ঃ 01 January 2026 12:00:00 AM )", "987.43"],
])}<table><tr><th>তারিখ</th></tr><tr><td>synthetic</td></tr></table>`;

test("get_meter_status exposes operational fields only", async () => {
  const { ctx, requests } = runtime(profileHtml);
  const result = await nesco.tools.find((t) => t.name === "get_meter_status")!.run({}, { ...ctx, http: createHttp(nesco, ctx) });
  expect(result).toEqual({
    meterLast4: "0001",
    office: "Bogura S&D 1",
    feederName: "Feeder 04",
    tariff: "LT-A",
    meterType: "Single-Phase",
    meterStatus: "Active",
    approvedLoadKw: "2",
    minRecharge: "50",
    balance: "987.43",
    balanceUpdatedAt: "01 January 2026 12:00:00 AM",
    verifiedWithLiveAccount: false,
  });
  expect(new URLSearchParams(String(requests[1]?.body)).get("submit")).toBe("মাসিক ব্যবহার");
});

test("profile parsing skips the label walk when no record grid exists", () => {
  expect(parseProfile(form)).toBeNull();
  expect(hasResult(form)).toBe(false);
  expect(hasResult(profileHtml)).toBe(true);
});

test("the label walk survives field order changes and label whitespace", () => {
  const shuffled = `${grid([["   অনুমোদিত   ট্যারিফ  ", "LT-B"], ["মিটারের ধরণ", "Three-Phase"], ["অবশিষ্ট ব্যালেন্স (টাকা) (সময়ঃ 02 February 2026 3:04:05 PM )", "12.34"]])}`;
  expect(parseProfile(shuffled)).toMatchObject({ tariff: "LT-B", meterType: "Three-Phase", balance: "12.34", balanceUpdatedAt: "02 February 2026 3:04:05 PM" });
});

test("an unknown meter is NOT_FOUND, not upstream drift", async () => {
  const { ctx, requests } = runtime(form);
  await Promise.all(["get_recharge_history", "get_monthly_usage", "get_meter_status"].map(async (name) => {
    await expect(nesco.tools.find((t) => t.name === name)!.run({}, { ...ctx, http: createHttp(nesco, ctx) }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  }));
  expect(requests.length).toBeGreaterThan(0);
});

test("the live recharge-table shape (15 Bengali columns) passes the gate", () => {
  const liveShaped = [
    ["ক্র নং", "Seq No.", "টোকেন নম্বর", "মিটার রেন্ট (টাকা)", "ডিমান্ড চার্জ (টাকা)", "পিএফসি চার্জ (টাকা)", "ভ্যাট (টাকা)", "পরিশোধিত বকেয়া/জরিমানা (টাকা)", "রেয়াত (টাকা)", "বিদ্যুৎ (টাকা)", "রিচার্জের পরিমাণ (টাকা)", "সম্ভাব্য বিদ্যুৎ এর পরিমাণ (কি.ও.আ.)", "রিচার্জের মাধ্যম", "রিচার্জের তারিখ", "রিমোট রিচার্জ স্ট্যাটাস"],
    ["1", "", "1111-2222-3333-4444-5555", "0", "0", "0", "333.33", "0", "-33.17", "6699.84", "7000", "401.63", "BKASH", "02-NOV-2026 7:36 PM", "Success"],
  ].map((cells, i) => i === 0 ? `<tr>${cells.map((c) => `<th>${c}</th>`).join("")}</tr>` : `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  const tables = parseHistory(`<table><thead>${liveShaped}</thead></table>`);
  expect(tables).toHaveLength(1);
  expect(tables[0]!.columns).toHaveLength(15);
  expect(tables[0]!.rows[0]).toHaveLength(15);
});
