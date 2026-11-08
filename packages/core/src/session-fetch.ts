export type SessionFetch = {
  /** fetch that stores Set-Cookie values and sends them back on later requests. */
  fetch: typeof fetch;
  cookie(name: string): string | undefined;
  clear(): void;
};

/**
 * Small in-memory cookie jar. It matches cookies by host only and ignores
 * Path, Domain and Expires. It honors Max-Age=0 as a delete.
 * Replace with tough-cookie if a portal needs full cookie rules.
 */
export function createSessionFetch(base: typeof fetch = fetch): SessionFetch {
  const jars = new Map<string, Map<string, string>>();

  const jarFor = (host: string) => {
    let jar = jars.get(host);
    if (!jar) {
      jar = new Map();
      jars.set(host, jar);
    }
    return jar;
  };

  const sessionFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const host = new URL(url).host;
    const jar = jarFor(host);
    const headers = new Headers(init?.headers);
    if (jar.size > 0) {
      headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
    }
    const response = await base(url, { ...init, headers });
    for (const line of response.headers.getSetCookie()) {
      const [pair = "", ...attributes] = line.split(";").map((part) => part.trim());
      const eq = pair.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const maxAge = attributes.find((a) => a.toLowerCase().startsWith("max-age="));
      if (maxAge !== undefined && Number(maxAge.slice(8)) <= 0) {
        jar.delete(name);
      } else {
        jar.set(name, value);
      }
    }
    return response;
  };

  return {
    fetch: sessionFetch as unknown as typeof fetch,
    cookie(name) {
      for (const jar of jars.values()) {
        const value = jar.get(name);
        if (value !== undefined) {
          return value;
        }
      }
      return undefined;
    },
    clear() {
      jars.clear();
    },
  };
}
