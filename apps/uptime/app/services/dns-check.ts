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

export type { DnsRecordType };

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
	/** Whether address answers were dropped because a CNAME owns the name — see below. */
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
 * answer that is not a clean `NOERROR`.
 *
 * Deliberately unlike {@link queryDnsRecords}: this is the resolve-and-verify step of the
 * public probe's SSRF and DNS-rebinding defence, where a name that does not resolve and a
 * resolver that could not be reached must both refuse the probe, and where the address
 * reached by following a CNAME is exactly the address that must be inspected. Answers are
 * returned as the resolver wrote them, unnormalized, for the same reason.
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
			 * The outermost quote pair only. Correct normalization lives in
			 * `normalizeDnsRecordValue` and is not applied here on purpose — this function
			 * answers to the probe fence, which inspects addresses and must see the resolver's
			 * own bytes.
			 */
			if (recordType === "TXT" && data.startsWith('"') && data.endsWith('"')) {
				return data.slice(1, -1);
			}
			return data;
		});

	return { values, responseTimeMs };
}

/**
 * Resolves one `(name, type)` for the sweep, distinguishing "no records of this type here"
 * from "we did not find out". It never throws: a failure is a value the caller diffs around.
 *
 * Three rules a sweep needs that a single-record check does not:
 *
 * 1. `NXDOMAIN` and `NOERROR` with no answers both mean *none*. A zone-file name that has
 *    been retired, or a name with addresses but no mail, hits one of them on every check, so
 *    treating either as an error would park every domain monitor in `error` forever. Only
 *    `SERVFAIL` and the other response codes, a transport failure, or a non-2xx response are
 *    errors.
 * 2. A CNAME **in the answer** suppresses A/AAAA tracking at that name.
 *    `?name=www.github.com&type=A` answers with the CNAME *and* `github.com`'s address, and
 *    filtering by type keeps the latter — an address that exists in nobody's zone as
 *    `www.github.com`. Storing it would alert the customer every time an unrelated third
 *    party rotated an address. The CNAME itself is tracked; where it points is the target's
 *    business.
 *
 *    The trigger is the CNAME answer, not the shape of the customer's zone, and the two
 *    come apart: a name a CDN proxies is a CNAME in the zone file and plain A records at
 *    the edge in DNS, with no CNAME in the answer at all. Nothing is suppressed there and
 *    nothing should be — the edge addresses are the authoritative answer, and the fact that
 *    they do not match the zone file is a true observation this reports rather than hides.
 * 3. Answers are filtered to the queried type code, which matters precisely because a CNAME
 *    answer rides along in an address query.
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
 * Sweeps every supported record type at one name, which is what makes a name's coverage
 * complete: a DNS answer carries the full RRset, so an addition inside a tracked name shows
 * up beside the records already stored.
 *
 * The types run together — {@link QUERIES_PER_NAME} subrequests, a fixed and small number.
 * Fanning out across *names* is the caller's job, because the per-invocation subrequest
 * budget is spent in names and only the caller knows how many it has left.
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
 * already normalized, so the only folding left is the MX `hostOnly` affordance: an expected
 * token without a space is a mail host the caller does not want pinned to a preference,
 * while a token with one is read as `preference host` and pins it.
 */
function comparisonKey(value: string, recordType: DnsRecordType, hostOnly: boolean): string {
	if (recordType !== "MX" || !hostOnly) return value;
	let separator = value.indexOf(" ");
	return separator === -1 ? value : value.slice(separator + 1);
}

/**
 * Tests whether every configured token is PRESENT among the resolved records — containment,
 * not set equality. Tokens are matched element-wise against whole records so that a token
 * never satisfies itself against a longer record it merely appears inside: `aspmx.l.google.com`
 * must not be considered found because `alt1.aspmx.l.google.com.` was resolved.
 *
 * SECURITY TRADEOFF, deliberate: because extra resolved records are tolerated, an attacker
 * who ADDS a hostile record while leaving the configured ones in place is not flagged. This
 * survives only for the stateless ad-hoc probe, which has one record type and one expected
 * value and no history to diff against. A domain monitor closes that hole by construction —
 * an added record is not stored, so the sweep reports it as new.
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
		let hostOnly = recordType === "MX" && !token.includes(" ");
		let key = comparisonKey(normalizeDnsRecordValue(recordType, token), recordType, hostOnly);
		return values.some((value) => comparisonKey(value, recordType, hostOnly) === key);
	});
}

/**
 * Resolves and classifies one single-record probe: `changed` when a configured expected value
 * is not contained in the resolved records, or — with no expected value — when the resolved
 * set differs from the previously resolved one. The first check has no previous value, so it
 * classifies as `ok` and becomes the baseline once the caller persists it.
 *
 * This is the shape the ad-hoc ping endpoint asks for. A stored domain monitor does not use
 * it: its expectation is a table of records, not a transcribed string.
 */
export async function checkDns(
	domain: string,
	recordType: DnsRecordType,
	expectedValue: string | null,
	previousValue: string | null,
): Promise<DnsCheckResult> {
	try {
		/**
		 * Deliberately not routed through `resolveDns`: that function's legacy outermost-quote
		 * strip runs before normalization can see the value, which turns a chunked TXT record
		 * into a different string than either channel would produce for it.
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
