/**
 * DNS lookup and status-classification logic for DNS monitors, shared by the scheduled
 * `CheckDnsJob` and the manual "Check now" action. Resolves records via Cloudflare's
 * DNS-over-HTTPS JSON API rather than a platform DNS module (Workers have no raw DNS
 * socket access). See `resources/docs/concepts/dns-monitors.md` for the product rules this
 * implements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

const DOH_URL = new URL("https://cloudflare-dns.com/dns-query");

export type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS";
export type DnsCheckStatus = "ok" | "changed" | "error";

const RECORD_TYPE_CODES: Record<DnsRecordType, number> = {
	A: 1,
	AAAA: 28,
	CNAME: 5,
	MX: 15,
	TXT: 16,
	NS: 2,
};

const DnsAnswerSchema = s.object({
	name: s.string(),
	type: s.number(),
	TTL: s.number(),
	data: s.string(),
});

const DnsResponseSchema = s.object({
	Status: s.number(),
	Answer: s.optional(s.array(DnsAnswerSchema)),
});

export interface DnsCheckResult {
	status: DnsCheckStatus;
	resolvedValue: string | null;
	responseTimeMs: number;
	errorMessage?: string;
}

/** Resolves `domain`'s `recordType` records via Cloudflare's DoH JSON API. */
export async function resolveDns(
	domain: string,
	recordType: DnsRecordType,
): Promise<{ values: string[]; responseTimeMs: number }> {
	let url = new URL(DOH_URL);
	url.searchParams.set("name", domain);
	url.searchParams.set("type", recordType);

	let startedAt = performance.now();
	let response = await fetch(url, { headers: { accept: "application/dns-json" } });
	let responseTimeMs = Math.round(performance.now() - startedAt);

	if (!response.ok) throw new Error(`DNS query failed with status ${response.status}`);

	let body = s.parse(DnsResponseSchema, await response.json());
	if (body.Status !== 0) throw new Error(`DNS query returned status code ${body.Status}`);

	let typeCode = RECORD_TYPE_CODES[recordType];
	let values = (body.Answer ?? [])
		.filter((record) => record.type === typeCode)
		.map((record) => {
			let data = record.data;
			if (recordType === "TXT" && data.startsWith('"') && data.endsWith('"')) {
				return data.slice(1, -1);
			}
			return data;
		});

	return { values, responseTimeMs };
}

/** Normalizes a possibly multi-value DNS answer for stable storage and display: sorted, joined. */
function normalize(values: string[]): string | null {
	return values.length > 0 ? [...values].sort().join(", ") : null;
}

/** Drops the root label's trailing dot so `example.com.` and `example.com` compare equal. */
function stripTrailingDot(value: string): string {
	return value.endsWith(".") ? value.slice(0, -1) : value;
}

/**
 * Comparison key for one record. Hostname-shaped records (CNAME, NS, and the host half
 * of MX) are case-insensitive and root-dot-insensitive per DNS itself, so both sides are
 * lowercased and un-dotted. A/AAAA/TXT keep byte-exact comparison: TXT payloads such as
 * DKIM keys and SPF strings are case- and whitespace-significant, and address literals
 * gain nothing from folding.
 *
 * MX answers arrive as `"<preference> <host>"`. `hostOnly` asks for just the host half,
 * which is how an expected token without a space is matched — the user typed a mail host
 * and does not care which preference it carries. A token *with* a space is read as
 * `preference host` and compared against the full record, pinning the preference too.
 */
function comparisonKey(value: string, recordType: DnsRecordType, hostOnly: boolean): string {
	if (recordType === "CNAME" || recordType === "NS") {
		return stripTrailingDot(value.toLowerCase());
	}

	if (recordType === "MX") {
		let separator = value.indexOf(" ");
		if (separator === -1) return stripTrailingDot(value.toLowerCase());
		let preference = value.slice(0, separator);
		let host = stripTrailingDot(
			value
				.slice(separator + 1)
				.trim()
				.toLowerCase(),
		);
		return hostOnly ? host : `${preference} ${host}`;
	}

	return value;
}

/**
 * Tests whether every configured token is PRESENT among the resolved records — containment,
 * not set equality. Tokens are matched element-wise against whole records so that a token
 * never satisfies itself against a longer record it merely appears inside: `aspmx.l.google.com`
 * must not be considered found because `alt1.aspmx.l.google.com.` was resolved.
 *
 * SECURITY TRADEOFF, deliberate: because extra resolved records are tolerated, an attacker
 * who ADDS a hostile record (say a rogue MX that outranks the legitimate ones) while leaving
 * the configured ones in place will NOT be flagged. Exact set-equality caught that, at the
 * price of forcing users to transcribe every record verbatim. Users who need the stricter
 * guarantee should list the full record set and rely on the no-expected-value baseline mode,
 * which still reports any deviation from the previously resolved set.
 *
 * An empty token list requires nothing and therefore always matches.
 */
function containsExpected(
	values: string[],
	expectedValue: string,
	recordType: DnsRecordType,
): boolean {
	let tokens = expectedValue
		.split(",")
		.map((token) => token.trim())
		.filter(Boolean);

	return tokens.every((token) => {
		let hostOnly = !token.includes(" ");
		let key = comparisonKey(token, recordType, hostOnly);
		return values.some((value) => comparisonKey(value, recordType, hostOnly) === key);
	});
}

/**
 * Resolves and classifies one DNS check: `changed` when a configured expected value is not
 * contained in the resolved records, or when no expected value is configured, when the
 * resolved set differs from the previously resolved one (change detection).
 * The very first check has no previous value, so it classifies as `ok` and its result
 * becomes the baseline for every later comparison once the caller persists it.
 */
export async function checkDns(
	domain: string,
	recordType: DnsRecordType,
	expectedValue: string | null,
	previousValue: string | null,
): Promise<DnsCheckResult> {
	try {
		let { values, responseTimeMs } = await resolveDns(domain, recordType);
		let resolvedValue = normalize(values);
		let status: DnsCheckStatus = "ok";

		if (expectedValue !== null) {
			if (!containsExpected(values, expectedValue, recordType)) status = "changed";
		} else if (previousValue !== null && resolvedValue !== previousValue) {
			status = "changed";
		}

		return { status, resolvedValue, responseTimeMs };
	} catch (error) {
		return {
			status: "error",
			resolvedValue: null,
			responseTimeMs: 0,
			errorMessage: error instanceof Error ? error.message : String(error),
		};
	}
}

/** Human-readable label for a DNS monitor's status badge. */
export function getDnsStatusText(status: DnsCheckStatus | null): string {
	switch (status) {
		case "ok":
			return "OK";
		case "changed":
			return "Changed";
		case "error":
			return "Error";
		default:
			return "Not checked";
	}
}
