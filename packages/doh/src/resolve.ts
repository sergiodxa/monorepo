/**
 * Looks a name up over DNS over HTTPS: one `fetch` to the resolver in its JSON or RFC 8484
 * wire format, the RCODE classified into a typed failure, and the answer split into the
 * records of the asked type and the CNAME chain that led to them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isSuccess, success } from "@sdxc/result";
import { canonicalType, parseRecordData, typeName } from "@sdxc/zone-file";

import type { DoHError } from "./errors.js";
import type { Message } from "./exchange.js";
import type { DoH } from "./types.js";

import { NameNotFoundError, ResponseCodeError, ServerFailureError } from "./errors.js";
import { queryJson } from "./json.js";
import { CLOUDFLARE } from "./resolvers.js";
import { queryWire } from "./wire.js";

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
 * @example let answer = await resolve("example.com", "HTTPS", { resolver: CLOUDFLARE_WIRE });
 */
export async function resolve<Type extends DoH.RecordType>(
	name: string,
	type: Type,
	options: DoH.ResolveOptions = {},
): Promise<Result<DoH.Answer<Type>, DoHError>> {
	let resolver = options.resolver ?? CLOUDFLARE;
	let timeoutMs = options.timeoutMs ?? 5000;
	let asked = canonicalType(type);

	let timeout = AbortSignal.timeout(timeoutMs);
	let signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
	let deadline = { signal, timeout, timeoutMs };
	let query = {
		name,
		type: asked,
		dnssec: options.dnssec ?? false,
		checkingDisabled: options.checkingDisabled ?? false,
	};
	let started = performance.now();

	let message =
		resolver.format === "wire"
			? await queryWire(resolver, query, deadline)
			: await queryJson(resolver, query, deadline);
	if (!isSuccess(message)) return message;
	let durationMs = Math.round(performance.now() - started);

	let { rcode, extendedErrors } = message.data;
	if (rcode === 3) {
		let ttl = negativeTtl(message.data);
		return failure(new NameNotFoundError(name, ttl, message.data.authenticated, extendedErrors));
	}
	if (rcode === 2) return failure(new ServerFailureError(name, extendedErrors));
	if (rcode !== 0) return failure(new ResponseCodeError(name, rcode, extendedErrors));

	let records: DoH.RecordFor<Type>[] = [];
	let unparsed: DoH.UnknownRecord[] = [];
	let chain: DoH.CNAMERecord[] = [];

	for (let record of message.data.answer) {
		let recordType = typeName(record.type);
		if (recordType !== asked && recordType !== "CNAME") continue;

		let base = { name: record.name, ttl: record.ttl };

		if (recordType === asked) {
			let data = parseRecordData(recordType as Type, record.data);
			if (isSuccess(data)) records.push({ ...base, ...data.data });
			else unparsed.push({ ...base, type: recordType, data: record.data });
		} else {
			let data = parseRecordData("CNAME", record.data);
			if (isSuccess(data)) chain.push({ ...base, ...data.data });
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
		authenticated: message.data.authenticated,
		truncated: message.data.truncated,
		extendedErrors,
		durationMs,
	});
}

/**
 * The negative-caching TTL of an NXDOMAIN (RFC 2308 section 5): the smaller of the SOA
 * record's own TTL and its `minimum` field, or `null` without a readable SOA.
 */
function negativeTtl(message: Message): number | null {
	let soa = message.authority.find((record) => typeName(record.type) === "SOA");
	if (!soa) return null;
	let data = parseRecordData("SOA", soa.data);
	return isSuccess(data) ? Math.min(soa.ttl, data.data.minimum) : null;
}
