/**
 * Finds the certificate a host is most likely serving from Certificate Transparency logs,
 * searched through Cert Spotter's issuances API, since a Worker's `fetch()` exposes no TLS
 * details and the RFC 6962/9162 log APIs cannot search by name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache, CacheWriteOptions } from "@sdxc/cache";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { follow, readText, release } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

/**
 * Cert Spotter's issuances search. It returns only unexpired certificates, merges each
 * precertificate with its final certificate, and with `match_wildcards` also returns the
 * wildcard certificates whose name covers the host.
 */
const SEARCH_URL = "https://api.certspotter.com/v1/issuances";

/**
 * Pages read for one host. Results arrive oldest first, so a host with more unexpired
 * certificates than this answers `unavailable` instead of a certificate that may be stale.
 */
const MAX_PAGES = 5;

/** The most bytes one page may carry; a page of fifty certificates is about 30 KB. */
const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/** How long one page may take, redirects and body included. */
const PAGE_TIMEOUT = "15 seconds";

/**
 * How long a host's certificates are reused. Cert Spotter itself marks its answers
 * cacheable for four hours, and the daily check needs one answer per host per day.
 */
const DEFAULT_TTL: NonNullable<CacheWriteOptions["ttl"]> = "6 hours";

/** Versioned, so a change to the cached shape starts from an empty cache. */
const CACHE_PREFIX = "ct:certspotter:v1:";

/** The CA that signed an issuance. */
const ISSUER_SCHEMA = s.object({
	friendly_name: s.optional(s.nullable(s.string())),
	name: s.string(),
});

/** The fields of one issuance the lookup reads; Cert Spotter sends more. */
const ISSUANCES_SCHEMA = s.array(
	s.object({
		id: s.string(),
		dns_names: s.array(s.string()),
		not_before: s.string(),
		not_after: s.string(),
		revoked: s.optional(s.nullable(s.boolean())),
		cert_sha256: s.optional(s.string()),
		issuer: s.optional(s.nullable(ISSUER_SCHEMA)),
	}),
);

/** A logged certificate whose names cover the host it was searched for. */
export interface LoggedCertificate {
	/** SHA-256 of the certificate, hex, the id crt.sh and Cert Spotter both search by. */
	sha256: string | null;
	names: string[];
	/** The CA's friendly name when Cert Spotter knows one, its subject otherwise. */
	issuer: string | null;
	/** Epoch milliseconds. */
	notBefore: number;
	/** Epoch milliseconds. */
	notAfter: number;
}

/**
 * What a lookup learned. `not-found` means the logs answered and hold no valid certificate
 * covering the host; `unavailable` means they could not be asked, so nothing is known.
 */
export type CertificateLookup =
	| { status: "found"; certificate: LoggedCertificate }
	| { status: "not-found" }
	| { status: "unavailable"; reason: string };

/** How a lookup client caches what it learns. */
export interface CertificateTransparencyOptions {
	cache: Cache;
	/** @default "6 hours" */
	ttl?: CacheWriteOptions["ttl"];
}

/** Lowercased, without the trailing dot a fully qualified name may carry. */
function normalizeName(name: string): string {
	return name.trim().toLowerCase().replace(/\.$/, "");
}

/** Whether a host is an address literal, which public CAs certify only rarely and CT search does not index. */
function isAddressLiteral(host: string): boolean {
	return host.startsWith("[") || host.includes(":") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * Whether a certificate name covers a host under RFC 6125: the same name, or a wildcard
 * in the leftmost label standing for exactly one label, so `*.example.com` covers
 * `www.example.com` and neither `example.com` nor `a.b.example.com`.
 *
 * @param name - A DNS name from the certificate.
 * @param host - The monitored host.
 * @example coversHost("*.example.com", "www.example.com"); // true
 */
export function coversHost(name: string, host: string): boolean {
	let pattern = normalizeName(name);
	let target = normalizeName(host);
	if (pattern === target) return true;
	if (!pattern.startsWith("*.")) return false;

	let dot = target.indexOf(".");
	return dot > 0 && target.slice(dot + 1) === pattern.slice(2);
}

/**
 * The certificate a host most likely serves: of those covering it and valid at `now`, the
 * one issued last, ties going to the later expiry. CT records issuance, so a certificate
 * issued and never deployed can still be the answer.
 *
 * @param host - The monitored host.
 * @param certificates - Logged certificates to choose from.
 * @param now - Epoch milliseconds to judge validity at.
 * @returns The chosen certificate, or `null` when none is valid for the host.
 */
export function pickCertificate(
	host: string,
	certificates: LoggedCertificate[],
	now: number,
): LoggedCertificate | null {
	let valid = certificates.filter(
		(certificate) =>
			certificate.notBefore <= now &&
			now < certificate.notAfter &&
			certificate.names.some((name) => coversHost(name, host)),
	);
	valid.sort((a, b) => b.notBefore - a.notBefore || b.notAfter - a.notAfter);
	return valid[0] ?? null;
}

/** Whether a `Link` header names a next page. */
function hasNextPage(link: string | null): boolean {
	return link !== null && /rel="?next"?/.test(link);
}

/** The search result: certificates covering the host, or why the logs could not be read. */
type SearchResult =
	| { ok: true; certificates: LoggedCertificate[] }
	| { ok: false; reason: string; rateLimited: boolean };

/**
 * Looks hosts up in Certificate Transparency logs. One instance serves one run: it asks
 * once per host however many monitors share it, and after the service answers `429` it
 * answers `unavailable` for the rest of the run instead of spending more of the limit.
 *
 * @example let lookup = await new CertificateTransparency({ cache }).lookup("www.example.com");
 */
export class CertificateTransparency {
	#cache: Cache;
	#ttl: NonNullable<CacheWriteOptions["ttl"]>;
	#inFlight = new Map<string, Promise<SearchResult>>();
	#rateLimited = false;

	/** @param options - The cache answers are kept in and for how long. */
	constructor(options: CertificateTransparencyOptions) {
		this.#cache = options.cache;
		this.#ttl = options.ttl ?? DEFAULT_TTL;
	}

	/**
	 * Finds the certificate a host most likely serves. An address literal answers
	 * `not-found` without a request, since CT search indexes names.
	 *
	 * @param hostname - The monitored host, as `URL.hostname` spells it.
	 * @param now - Epoch milliseconds to judge validity at.
	 */
	async lookup(hostname: string, now: number = Date.now()): Promise<CertificateLookup> {
		let host = normalizeName(hostname);
		if (host === "" || isAddressLiteral(host)) return { status: "not-found" };

		let found = this.#inFlight.get(host);
		if (!found) {
			found = this.#certificatesFor(host);
			this.#inFlight.set(host, found);
		}

		let result = await found;
		if (!result.ok) return { status: "unavailable", reason: result.reason };

		let certificate = pickCertificate(host, result.certificates, now);
		return certificate ? { status: "found", certificate } : { status: "not-found" };
	}

	/** The cached certificates for a host, searched on a miss; only a completed search is cached. */
	async #certificatesFor(host: string): Promise<SearchResult> {
		let key = `${CACHE_PREFIX}${host}`;
		let cached = await this.#cache.read<LoggedCertificate[]>(key);
		if (!isFailure(cached) && cached.data !== null) return { ok: true, certificates: cached.data };

		if (this.#rateLimited) {
			return { ok: false, reason: "Cert Spotter rate limit reached", rateLimited: true };
		}

		let result = await this.#search(host);
		if (result.ok) await this.#cache.write(key, result.certificates, { ttl: this.#ttl });
		else if (result.rateLimited) this.#rateLimited = true;
		return result;
	}

	/** Reads every page of a host's issuances, keeping the unrevoked ones that cover it. */
	async #search(host: string): Promise<SearchResult> {
		let certificates: LoggedCertificate[] = [];
		let after: string | null = null;

		for (let page = 0; page < MAX_PAGES; page++) {
			let url = new URL(SEARCH_URL);
			url.searchParams.set("domain", host);
			url.searchParams.set("match_wildcards", "true");
			url.searchParams.append("expand", "dns_names");
			url.searchParams.append("expand", "issuer");
			if (after !== null) url.searchParams.set("after", after);

			let followed = await follow(url, {
				timeout: PAGE_TIMEOUT,
				maxRedirects: 0,
				headers: { accept: "application/json" },
			});
			if (isFailure(followed)) {
				return { ok: false, reason: followed.error.message, rateLimited: false };
			}

			let { response } = followed.data;
			if (!response.ok) {
				release(response.body);
				let rateLimited = response.status === 429;
				return {
					ok: false,
					reason: rateLimited
						? "Cert Spotter rate limit reached"
						: `Cert Spotter answered ${response.status}`,
					rateLimited,
				};
			}

			let text = await readText(response, { maxBytes: MAX_PAGE_BYTES });
			if (isFailure(text)) return { ok: false, reason: text.error.message, rateLimited: false };

			let parsed = parseIssuances(text.data.text);
			if (parsed === null) {
				return { ok: false, reason: "Cert Spotter sent an unreadable answer", rateLimited: false };
			}

			for (let issuance of parsed) {
				if (issuance.revoked === true) continue;
				if (!issuance.dns_names.some((name) => coversHost(name, host))) continue;
				let notBefore = Date.parse(issuance.not_before);
				let notAfter = Date.parse(issuance.not_after);
				if (Number.isNaN(notBefore) || Number.isNaN(notAfter)) continue;
				certificates.push({
					sha256: issuance.cert_sha256 ?? null,
					names: issuance.dns_names,
					issuer: issuance.issuer?.friendly_name ?? issuance.issuer?.name ?? null,
					notBefore,
					notAfter,
				});
			}

			let last = parsed.at(-1);
			if (!last || !hasNextPage(response.headers.get("link"))) {
				return { ok: true, certificates };
			}
			after = last.id;
		}

		return {
			ok: false,
			reason: `More than ${MAX_PAGES} pages of certificates`,
			rateLimited: false,
		};
	}
}

/** One page of issuances, or `null` when the body is not the documented shape. */
function parseIssuances(text: string) {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return null;
	}
	let parsed = s.parseSafe(ISSUANCES_SCHEMA, json);
	return parsed.success ? parsed.value : null;
}

/**
 * A client for one run, caching in the app's KV namespace so monitors and runs sharing a
 * host share one search.
 */
export function certificateTransparency(): CertificateTransparency {
	return new CertificateTransparency({ cache: new WorkerKVCache(env.KV) });
}
