/**
 * The DoH JSON API (`application/dns-json`) as Cloudflare and Google answer it: the
 * question goes in the query string, and the validated envelope is read into the response
 * shape `resolve` works from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Deadline, Message, MessageRecord, Query } from "./exchange.js";
import type { DoH } from "./types.js";

import { TransportError } from "./errors.js";
import { exchange } from "./exchange.js";

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

/** Folds a name the way every owner name in an answer is reported. */
function normalizeName(name: string): string {
	let lower = name.toLowerCase();
	return lower.length > 1 && lower.endsWith(".") ? lower.slice(0, -1) : lower;
}

/** A record of the envelope in the shape both encodings share. */
function toRecord(record: s.InferOutput<typeof WIRE_RECORD_SCHEMA>): MessageRecord {
	return {
		name: normalizeName(record.name),
		type: record.type,
		ttl: record.TTL,
		data: record.data,
	};
}

/**
 * Asks a JSON resolver one question. The envelope carries no extended errors, so a JSON
 * response reports none.
 *
 * @param resolver - The endpoint, its URL taking `name`, `type`, `do` and `cd` parameters.
 * @param query - The question and flags.
 * @param deadline - Aborts the request.
 */
export async function queryJson(
	resolver: DoH.Resolver,
	query: Query,
	deadline: Deadline,
): Promise<Result<Message, TransportError>> {
	let url = new URL(resolver.url);
	url.searchParams.set("name", query.name);
	url.searchParams.set("type", /^TYPE\d+$/.test(query.type) ? query.type.slice(4) : query.type);
	if (query.dnssec) url.searchParams.set("do", "1");
	if (query.checkingDisabled) url.searchParams.set("cd", "1");

	let response = await exchange(url, "application/dns-json", deadline, (body) => body.json());
	if (isFailure(response)) return response;

	let parsed = s.parseSafe(ENVELOPE_SCHEMA, response.data.body);
	if (!parsed.success) {
		return failure(
			new TransportError("The resolver's response is not a DNS JSON answer", response.data.status),
		);
	}

	let envelope = parsed.value;
	return success({
		rcode: envelope.Status,
		authenticated: envelope.AD ?? false,
		truncated: envelope.TC ?? false,
		answer: (envelope.Answer ?? []).map(toRecord),
		authority: (envelope.Authority ?? []).map(toRecord),
		extendedErrors: [],
	});
}
