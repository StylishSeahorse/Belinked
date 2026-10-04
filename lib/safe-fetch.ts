import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { LookupFunction } from "node:net";

/**
 * Outbound HTTP for owner-triggered features (link previews, link health checks).
 * Guards against SSRF: only http(s), only public IPs (checked at connect time via a
 * custom DNS lookup, so DNS rebinding cannot swap in a private address), redirects
 * re-validated hop by hop, and bounded time and size.
 */

function ipv4ToInt(address: string) {
  return address.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const blockedV4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
];

export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const value = ipv4ToInt(address);
    return blockedV4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (lower.startsWith("::ffff:")) return true; // hex-form mapped addresses
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      /^fe[89ab]/.test(lower) || // link-local
      lower.startsWith("ff") || // multicast
      lower.startsWith("64:ff9b:") ||
      lower.startsWith("2001:db8")
    );
  }
  return true;
}

export class UnsafeUrlError extends Error {}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    const list = addresses as dns.LookupAddress[];
    const unsafe = list.find((entry) => isPrivateAddress(entry.address));
    if (!list.length || unsafe) return callback(new UnsafeUrlError("Private network URLs are not allowed."), "", 4);
    if ((options as dns.LookupOptions).all) return (callback as unknown as (err: null, all: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export function assertPublicUrl(input: string | URL) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError("Enter a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new UnsafeUrlError("Only http and https URLs are allowed.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("Local URLs are not allowed.");
  }
  if (net.isIP(host) && isPrivateAddress(host)) throw new UnsafeUrlError("Private network URLs are not allowed.");
  return url;
}

/** `body` is the response as text; `bytes` the raw bytes. `truncated` is set when maxBytes was hit. */
export type SafeResponse = { status: number; url: string; headers: http.IncomingHttpHeaders; body: string; bytes: Buffer; truncated: boolean };

function requestOnce(url: URL, method: "GET" | "HEAD", timeoutMs: number, maxBytes: number, headers: Record<string, string>): Promise<SafeResponse> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, { method, headers, lookup: safeLookup, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const finish = (truncated: boolean) => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: res.statusCode || 0, url: url.toString(), headers: res.headers, body: bytes.toString("utf8"), bytes, truncated });
      };
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy();
          finish(true);
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => finish(false));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("The request timed out.")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(
  input: string,
  { method = "GET", timeoutMs = 8000, maxBytes = 500_000, maxRedirects = 5, headers = {} }: { method?: "GET" | "HEAD"; timeoutMs?: number; maxBytes?: number; maxRedirects?: number; headers?: Record<string, string> } = {}
): Promise<SafeResponse> {
  let url = assertPublicUrl(input);
  const requestHeaders = { "user-agent": "Belinked/1.0 (+self-hosted link page)", ...headers };
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await requestOnce(url, method, timeoutMs, maxBytes, requestHeaders);
    const location = response.headers.location;
    if (response.status >= 300 && response.status < 400 && location) {
      url = assertPublicUrl(new URL(location, url));
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects.");
}
