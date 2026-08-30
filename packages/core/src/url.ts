import { getDomain } from "tldts";

import { InvalidLinkError, EveryQRCodeError, UnsupportedVersionError } from "./errors.js";

const IDENTITY_VERSION = 1;
const MAX_INPUT_BYTES = 4096;
const EXPLICIT_SCHEME = /^[a-z][a-z\d+.-]*:/iu;
const HTTP_SCHEME = /^https?:\/\//iu;
const TRACKING_QUERY_KEYS = new Set(["_ga", "_gl", "fbclid", "gclid", "msclkid"]);
const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "client_secret",
  "password",
  "passwd",
  "session",
  "sessionid",
  "signature",
  "token",
  "x-amz-signature",
]);

export type IdentityScope = "site" | "url";

export interface ParsedLink {
  readonly input: string;
  readonly payloadUrl: string;
  readonly familyIdentity: string;
  readonly siteIdentity: string;
  readonly pageIdentity: string;
  readonly displayHost: string;
  readonly hasSensitiveQuery: boolean;
  readonly scope: IdentityScope;
}

export type ParseLinkOptions = {
  readonly identityScope?: IdentityScope;
  readonly identityVersion?: number;
};

function isHostLike(value: string): boolean {
  const authority = value.split(/[/?#]/u, 1)[0] ?? "";
  if (!authority || authority.includes("@")) return false;
  if (/^\[[0-9a-f:.]+\](?::\d+)?$/iu.test(authority)) return true;

  const separator = authority.lastIndexOf(":");
  const hasPort = separator > -1;
  const host = hasPort ? authority.slice(0, separator) : authority;
  const port = hasPort ? authority.slice(separator + 1) : "";
  if (hasPort && !/^\d+$/u.test(port)) return false;
  if (host.toLowerCase() === "localhost") return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host)) return true;
  return host.includes(".") && !host.startsWith(".") && !host.endsWith(".");
}

function withDefaultScheme(value: string): string {
  if (value.startsWith("//")) return `https:${value}`;
  if (HTTP_SCHEME.test(value)) return value;
  if (isHostLike(value)) return `https://${value}`;
  if (EXPLICIT_SCHEME.test(value)) {
    throw new InvalidLinkError("Every QR Code supports only HTTP and HTTPS links.");
  }
  throw new InvalidLinkError("That link does not look valid yet.");
}

function validateUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidLinkError("Every QR Code supports only HTTP and HTTPS links.");
  }
  if (!url.hostname) throw new InvalidLinkError("That link needs a hostname.");
  if (url.username || url.password) {
    throw new InvalidLinkError("Links containing a username or password are not supported.");
  }
}

function removeDefaultPort(url: URL): void {
  const isDefaultHttp = url.protocol === "http:" && url.port === "80";
  const isDefaultHttps = url.protocol === "https:" && url.port === "443";
  if (isDefaultHttp || isDefaultHttps) url.port = "";
}

function isTrackingQueryKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith("utm_") || TRACKING_QUERY_KEYS.has(normalized);
}

function createPageIdentity(url: URL): string {
  const page = new URL(url);
  const retainedParameters = new URLSearchParams();
  page.hash = "";
  for (const [key, value] of page.searchParams) {
    if (!isTrackingQueryKey(key)) retainedParameters.append(key, value);
  }
  retainedParameters.sort();
  page.search = retainedParameters.toString();
  return page.toString();
}

function hasSensitiveQuery(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) return true;
  }
  return false;
}

function getFamilyIdentity(hostname: string): string {
  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
}

export function parseLink(input: string, options: ParseLinkOptions = {}): ParsedLink {
  const version = options.identityVersion ?? IDENTITY_VERSION;
  const scope = options.identityScope ?? "site";
  if (version !== IDENTITY_VERSION) throw new UnsupportedVersionError("identity", version);

  if (new TextEncoder().encode(input).length > MAX_INPUT_BYTES) {
    throw new InvalidLinkError("That link is longer than Every QR Code can safely process.");
  }
  const normalizedInput = input.trim();
  if (!normalizedInput) throw new InvalidLinkError("Enter a link to discover its form.");

  let url: URL;
  try {
    url = new URL(withDefaultScheme(normalizedInput));
  } catch (error) {
    if (error instanceof EveryQRCodeError) throw error;
    throw new InvalidLinkError("That link does not look valid yet.");
  }
  validateUrl(url);
  removeDefaultPort(url);
  const payloadUrl = url.toString();
  return {
    displayHost: url.host,
    familyIdentity: getFamilyIdentity(url.hostname),
    hasSensitiveQuery: hasSensitiveQuery(url),
    input,
    pageIdentity: createPageIdentity(url),
    payloadUrl,
    scope,
    siteIdentity: url.hostname,
  };
}
