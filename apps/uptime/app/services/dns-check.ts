/**
 * DNS resolution for domain monitors: sweeping every supported record type at a name so a
 * check sees the whole of what a name publishes, and the single-record probe the ad-hoc ping
 * endpoint still asks for. Records resolve over Cloudflare's DNS-over-HTTPS JSON API because
 * Workers have no raw DNS socket. See `resources/docs/concepts/dns-monitors.md` for the
 * product rules this implements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { DnsRecordType } from "~/app/lib/dns-record-value";

import {
	DNS_RECORD_TYPES,
	normalizeDnsName,
	normalizeDnsRecordValue,
} from "~/app/lib/dns-record-value";

const DOH_URL = new URL("https://cloudflare-dns.com/dns-query");

export type DnsCheckStatus = "ok" | "changed" | "error";

/**
 * How many outbound queries one swept name costs. Exported because the per-check query
 * budget of the sweep job is counted in names, and this is the multiplier that turns a name
 * count into a subrequest count against the platform's per-invocation ceiling.
 */
export const QUERIES_PER_NAME = DNS_RECORD_TYPES.length;

const RECORD_TYPE_CODES: Record<DnsRecordType, number> = {
	A: 1,
	AAAA: 28,
	CNAME: 5,
	MX: 15,
	TXT: 16,
	NS: 2,
};

/** `NXDOMAIN`: the name does not exist. Not a failure — see {@link queryDnsRecords}. */
const NXDOMAIN = 3;

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

/** What one `(name, type)` query found, or why it found nothing out. */
export interface DnsQueryOutcome {
	name: string;
	recordType: DnsRecordType;
	/**
	 * The full RRset, normalized. Empty means the name publishes no records of this type —
	 * which is a fact, not a failure, and only trustworthy when `errorMessage` is `null`.
	 */
	values: string[];
	responseTimeMs: number;
	/**
	 * `null` when the query answered. Otherwise the reason it did not, and the caller MUST
	 * apply no diff for this `(name, type)`: a resolver having a bad minute must never be
	 * read as "every record at this name vanished".
	 */
	errorMessage: string | null;
	/**
	 * Whether A/AAAA answers were dropped because the same response carried a CNAME. The
	 * answer itself is the trigger, so a CDN-proxied name — CNAME in the zone, plain A records
	 * at the edge — keeps its edge addresses, since its answers carry no CNAME.
	 */
	suppressedByCname: boolean;
}

/** Everything one name publishes across the supported types, as of one check. */
export interface DnsNameSweep {
	name: string;
	outcomes: DnsQueryOutcome[];
	/** Queries that did not answer; `dns_monitor_results.queries_failed` is the sum of these. */
	queriesFailed: number;
	/**
	 * The slowest single query, not the sum. The column it feeds means "how long did DNS take
	 * to answer", and summing would quietly turn a latency chart into a cost chart.
	 */
	responseTimeMs: number;
}

/**
 * Resolves `domain`'s `recordType` records via Cloudflare's DoH JSON API, throwing on any
 * answer that is not a clean `NOERROR`. Backs the SSRF and DNS-rebinding defence, where an
 * unresolved name and an unreachable resolver must both refuse the probe.
 */
export async function resolveDns(
	domain: string,
	recordType: DnsRecordType,
): Promise<{ values: string[]; responseTimeMs: number }> {
	let { status, answers, responseTimeMs } = await queryDoh(domain, recordType);
	if (status !== 0) throw new Error(`DNS query returned status code ${status}`);

	let typeCode = RECORD_TYPE_CODES[recordType];
	let values = answers
		.filter((record) => record.type === typeCode)
		.map((record) => {
			let data = record.data;
			/**
			 * The outermost quote pair only. This function passes the resolver's own
			 * bytes to the probe fence unnormalized, on purpose: the fence must
			 * inspect addresses exactly as returned; normalization lives in `normalizeDnsRecordValue`.
			 */
			if (recordType === "TXT" && data.startsWith('"') && data.endsWith('"')) {
				return data.slice(1, -1);
			}
			return data;
		});

	return { values, responseTimeMs };
}

/**
 * Resolves one `(name, type)` for the sweep, returning any failure as a value the caller
 * diffs around. `NXDOMAIN` and empty `NOERROR` both mean "no records of this type here" —
 * treating either as an error would park a retired or mail-less domain in `error` forever.
 */
export async function queryDnsRecords(
	name: string,
	recordType: DnsRecordType,
): Promise<DnsQueryOutcome> {
	let owner = normalizeDnsName(name);

	try {
		let { status, answers, responseTimeMs } = await queryDoh(owner, recordType);

		if (status === NXDOMAIN) {
			return {
				name: owner,
				recordType,
				values: [],
				responseTimeMs,
				errorMessage: null,
				suppressedByCname: false,
			};
		}
		if (status !== 0) {
			return {
				name: owner,
				recordType,
				values: [],
				responseTimeMs,
				errorMessage: `DNS query returned status code ${status}`,
				suppressedByCname: false,
			};
		}

		let isAddressQuery = recordType === "A" || recordType === "AAAA";
		let suppressedByCname =
			isAddressQuery && answers.some((record) => record.type === RECORD_TYPE_CODES.CNAME);

		let typeCode = RECORD_TYPE_CODES[recordType];
		let values = suppressedByCname
			? []
			: answers
					.filter((record) => record.type === typeCode)
					.map((record) => normalizeDnsRecordValue(recordType, record.data));

		return {
			name: owner,
			recordType,
			values,
			responseTimeMs,
			errorMessage: null,
			suppressedByCname,
		};
	} catch (error) {
		return {
			name: owner,
			recordType,
			values: [],
			responseTimeMs: 0,
			errorMessage: error instanceof Error ? error.message : String(error),
			suppressedByCname: false,
		};
	}
}

/**
 * Sweeps every supported record type at one name — {@link QUERIES_PER_NAME} subrequests,
 * a fixed, small number — so a DNS answer's full RRset gives complete coverage. Fanning
 * out across names is the caller's job, since it owns the per-invocation subrequest budget.
 */
export async function sweepDnsName(name: string): Promise<DnsNameSweep> {
	let owner = normalizeDnsName(name);
	let outcomes = await Promise.all(
		DNS_RECORD_TYPES.map((recordType) => queryDnsRecords(owner, recordType)),
	);

	return {
		name: owner,
		outcomes,
		queriesFailed: outcomes.filter((outcome) => outcome.errorMessage !== null).length,
		responseTimeMs: outcomes.reduce(
			(slowest, outcome) => Math.max(slowest, outcome.responseTimeMs),
			0,
		),
	};
}

/** Performs the DoH round trip and validates its envelope. Throws on a non-2xx response. */
async function queryDoh(
	name: string,
	recordType: DnsRecordType,
): Promise<{
	status: number;
	answers: s.InferOutput<typeof DnsAnswerSchema>[];
	responseTimeMs: number;
}> {
	let url = new URL(DOH_URL);
	url.searchParams.set("name", name);
	url.searchParams.set("type", recordType);

	let startedAt = performance.now();
	let response = await fetch(url, { headers: { accept: "application/dns-json" } });
	let responseTimeMs = Math.round(performance.now() - startedAt);

	if (!response.ok) throw new Error(`DNS query failed with status ${response.status}`);

	let body = s.parse(DnsResponseSchema, await response.json());
	return { status: body.Status, answers: body.Answer ?? [], responseTimeMs };
}

/** Renders a possibly multi-value answer as one stable string: sorted, comma-joined. */
function joinValues(values: string[]): string | null {
	return values.length > 0 ? [...values].sort().join(", ") : null;
}

/**
 * Comparison key for the ad-hoc probe's expected-value matching. Values reaching it are
 * already normalized, so the only folding left is the MX `hostOnly` affordance: a
 * spaceless token is a bare mail host; one with a space pins it as `preference host`.
 */
function comparisonKey(value: string, recordType: DnsRecordType, hostOnly: boolean): string {
	if (recordType !== "MX" || !hostOnly) return value;
	let separator = value.indexOf(" ");
	return separator === -1 ? value : value.slice(separator + 1);
}

/**
 * Tests whether every configured token is present among the resolved records, matched
 * whole-record so a token can't be satisfied by a longer record it merely appears inside.
 * SECURITY: only the stateless ad-hoc probe uses this — a hostile record added here passes unnoticed.
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
		let hostOnly = recordType === "MX" && !token.includes(" ");
		let key = comparisonKey(normalizeDnsRecordValue(recordType, token), recordType, hostOnly);
		return values.some((value) => comparisonKey(value, recordType, hostOnly) === key);
	});
}

/**
 * Resolves and classifies one single-record probe: `changed` when a configured expected
 * value is missing from the resolved records, or, with no expected value, when the
 * resolved set differs from the previous one; a first check has no previous value and becomes the baseline.
 */
export async function checkDns(
	domain: string,
	recordType: DnsRecordType,
	expectedValue: string | null,
	previousValue: string | null,
): Promise<DnsCheckResult> {
	try {
		/**
		 * Normalizes each answer directly through `normalizeDnsRecordValue`, matching what the
		 * stored channel produces for a chunked TXT record — `resolveDns`'s quote strip runs
		 * before normalization can see the value and would otherwise yield a different string.
		 */
		let answer = await queryDoh(domain, recordType);
		if (answer.status !== 0) {
			throw new Error(`DNS query returned status code ${answer.status}`);
		}

		let typeCode = RECORD_TYPE_CODES[recordType];
		let normalized = answer.answers
			.filter((record) => record.type === typeCode)
			.map((record) => normalizeDnsRecordValue(recordType, record.data));
		let resolvedValue = joinValues(normalized);
		let status: DnsCheckStatus = "ok";

		if (expectedValue !== null) {
			if (!containsExpected(normalized, expectedValue, recordType)) status = "changed";
		} else if (previousValue !== null && resolvedValue !== previousValue) {
			status = "changed";
		}

		return { status, resolvedValue, responseTimeMs: answer.responseTimeMs };
	} catch (error) {
		return {
			status: "error",
			resolvedValue: null,
			responseTimeMs: 0,
			errorMessage: error instanceof Error ? error.message : String(error),
		};
	}
}
