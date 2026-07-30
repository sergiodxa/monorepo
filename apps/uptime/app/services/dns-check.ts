/**
 * DNS lookup and status-classification logic for DNS monitors, shared by the scheduled
 * `CheckDnsJob` and the manual "Check now" action. Resolves records via Cloudflare's
 * DNS-over-HTTPS JSON API rather than a platform DNS module (Workers have no raw DNS
 * socket access). See `docs/dns-monitors.md` for the product rules this implements.
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

/** Normalizes a possibly multi-value DNS answer for stable comparison: sorted, joined. */
function normalize(values: string[]): string | null {
	return values.length > 0 ? [...values].sort().join(", ") : null;
}

/**
 * Resolves and classifies one DNS check: `changed` against an explicit expected value,
 * or against the previously resolved value when none is configured (change detection).
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
			let expected = normalize(
				expectedValue
					.split(",")
					.map((value) => value.trim())
					.filter(Boolean),
			);
			if (resolvedValue !== expected) status = "changed";
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
