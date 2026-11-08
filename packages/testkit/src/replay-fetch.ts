export type Fixture = {
  /** Exact URL or a substring of it. */
  match: string;
  status?: number;
  /** JSON body (object) or raw text/HTML (string). */
  body: unknown;
  headers?: Record<string, string>;
};

/** Offline fetch that serves saved responses. Throws on any unmatched request. */
export function replayFetch(fixtures: Fixture[]): typeof fetch {
  const fn = async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const fixture = fixtures.find((f) => url === f.match || url.includes(f.match));
    if (!fixture) throw new Error(`replayFetch: no fixture for ${url}`);
    const isText = typeof fixture.body === "string";
    return new Response(isText ? (fixture.body as string) : JSON.stringify(fixture.body), {
      status: fixture.status ?? 200,
      headers: { "content-type": isText ? "text/html" : "application/json", ...fixture.headers },
    });
  };
  return fn as unknown as typeof fetch;
}
