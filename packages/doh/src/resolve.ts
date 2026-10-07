/**
 * Looks a name up over the DoH JSON API: one `fetch` to the resolver, the envelope
 * validated, the RCODE classified into a typed failure, and the answer split into the
 * records of the asked type and the CNAME chain that led to them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isSuccess, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { DoHError } from "./errors.js";
import type { DoH } from "./types.js";

import {
	NameNotFoundError,
	ResponseCodeError,
	ServerFailureError,
	TransportError,
} from "./errors.js";
import { parseRecordData } from "./parse-record-data.js";
import { canonicalType, typeName } from "./record-types.js";
import { CLOUDFLARE } from "./resolvers.js";

/** One resource record as the JSON API writes it. */
const WIRE_RECORD_SCHEMA = s.object({
	name: s.string(),
	type: s.number(),
	TTL: s.number(),
	data: s.string(),
});

/** The members of the JSON envelope this package reads; Cloudflare and Google both send them. */
const ENVELOPE_SCHEMA = s.object({
	Status: s.number(),
	TC: s.optional(s.boolean()),
	AD: s.optional(s.boolean()),
	Answer: s.optional(s.array(WIRE_RECORD_SCHEMA)),
	Authority: s.optional(s.array(WIRE_RECORD_SCHEMA)),
});

/** The envelope after validation. */
type Envelope = s.InferOutput<typeof ENVELOPE_SCHEMA>;

/** One record from the envelope. */
type WireRecord = s.InferOutput<typeof WIRE_RECORD_SCHEMA>;

/** Folds a name the way every owner name in an answer is reported. */
function normalizeName(name: string): string {
	let lower = name.toLowerCase();
	return lower.length > 1 && lower.endsWith(".") ? lower.slice(0, -1) : lower;
}

/**
 * Resolves `name`'s records of `type`. NXDOMAIN, SERVFAIL, any other RCODE and a request
 * that never produced an answer are distinct `DoHError` subclasses; a name that exists
 * with no records of the type succeeds with none. The name is sent as written, so an
 * internationalized name must already be in its ASCII form.
 *
 * @param name - The domain name to look up.
 * @param type - The record type, as a mnemonic or RFC 3597 `TYPEnnn`.
 * @param options - Resolver, DNSSEC flags, abort signal and timeout.
 * @returns The answer, or the typed reason there is none.
 * @template Type - The record type, which types the records returned.
 * @example let answer = await resolve("example.com", "MX");
 */
export async function resolve<Type extends DoH.RecordType>(
	name: string,
	type: Type,
	options: DoH.ResolveOptions = {},
): Promise<Result<DoH.Answer<Type>, DoHError>> {
	let resolver = options.resolver ?? CLOUDFLARE;
	let timeoutMs = options.timeoutMs ?? 5000;
	let asked = canonicalType(type);

	let url = new URL(resolver.url);
	url.searchParams.set("name", name);
	url.searchParams.set("type", /^TYPE\d+$/.test(asked) ? asked.slice(4) : asked);
	if (options.dnssec) url.searchParams.set("do", "1");
	if (options.checkingDisabled) url.searchParams.set("cd", "1");

	let timeout = AbortSignal.timeout(timeoutMs);
	let signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
	let started = performance.now();

	let envelope = await fetchEnvelope(url, signal, timeout, timeoutMs);
	if (!isSuccess(envelope)) return envelope;
	let durationMs = Math.round(performance.now() - started);

	let { Status: rcode } = envelope.data;
	if (rcode === 3) {
		let authenticated = envelope.data.AD ?? false;
		return failure(new NameNotFoundError(name, negativeTtl(envelope.data), authenticated));
	}
	if (rcode === 2) return failure(new ServerFailureError(name));
	if (rcode !== 0) return failure(new ResponseCodeError(name, rcode));

	let records: DoH.RecordFor<Type>[] = [];
	let unparsed: DoH.UnknownRecord[] = [];
	let chain: DoH.CNAMERecord[] = [];

	for (let record of envelope.data.Answer ?? []) {
		let recordType = typeName(record.type);
		if (recordType !== asked && recordType !== "CNAME") continue;

		let base = { name: normalizeName(record.name), ttl: record.TTL };
		let data = parseRecordData(recordType, record.data);

		if (recordType === asked) {
			if (isSuccess(data)) records.push({ ...base, ...data.data } as DoH.RecordFor<Type>);
			else unparsed.push({ ...base, type: recordType, data: record.data });
		} else if (isSuccess(data)) {
			chain.push({ ...base, ...(data.data as DoH.RecordData<"CNAME">) });
		}
	}

	let ttls = [...records, ...unparsed].map((record) => record.ttl);

	return success({
		name: normalizeName(name),
		type,
		records,
		unparsed,
		chain,
		ttl: ttls.length > 0 ? Math.min(...ttls) : null,
		authenticated: envelope.data.AD ?? false,
		truncated: envelope.data.TC ?? false,
		durationMs,
	});
}

/**
 * Sends the query and validates the envelope, mapping every way the exchange can fail
 * without a DNS answer to a `TransportError`.
 */
async function fetchEnvelope(
	url: URL,
	signal: AbortSignal,
	timeout: AbortSignal,
	timeoutMs: number,
): Promise<Result<Envelope, TransportError>> {
	let response: Response;
	try {
		response = await fetch(url, { headers: { Accept: "application/dns-json" }, signal });
	} catch (error) {
		let message = timeout.aborted
			? `The DNS query timed out after ${timeoutMs}ms`
			: `The DNS query failed: ${error instanceof Error ? error.message : String(error)}`;
		return failure(new TransportError(message, null, { cause: error }));
	}

	if (!response.ok) {
		return failure(
			new TransportError(`The resolver answered HTTP ${response.status}`, response.status),
		);
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch (error) {
		return failure(
			new TransportError("The resolver's response is not JSON", response.status, { cause: error }),
		);
	}

	let parsed = s.parseSafe(ENVELOPE_SCHEMA, body);
	if (!parsed.success) {
		return failure(
			new TransportError("The resolver's response is not a DNS JSON answer", response.status),
		);
	}
	return success(parsed.value);
}

/**
 * The negative-caching TTL of an NXDOMAIN (RFC 2308 section 5): the smaller of the SOA
 * record's own TTL and its `minimum` field, or `null` without a readable SOA.
 */
function negativeTtl(envelope: Envelope): number | null {
	let soa = (envelope.Authority ?? []).find(
		(record: WireRecord) => typeName(record.type) === "SOA",
	);
	if (!soa) return null;
	let data = parseRecordData("SOA", soa.data);
	return isSuccess(data) ? Math.min(soa.TTL, data.data.minimum) : null;
}
