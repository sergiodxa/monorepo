/**
 * Reads SMTP TLS Reporting policies (RFC 8460 §3): the `_smtp._tls` TXT record naming
 * where sending MTAs deliver their daily TLS reports, and the discovery rule that only one
 * `v=TLSRPTv1` record at the name counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DoHError } from "@sdxc/doh";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { LookupOptions } from "./lookup.js";

import { RecordParseError } from "./errors.js";
import { lookupTxt, normalizeDomain } from "./lookup.js";
import { isAbsoluteUri, splitTags, splitUriList } from "./tag-list.js";

/** RFC 8460's `tlsrpt-ext-name`. */
const FIELD_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/;

/** Groups the TLS-RPT types under one import surface. */
export namespace TLSRPT {
	/** A reporting policy. */
	export interface Record {
		/** Where reports go, as written: `mailto:` and `https:` URIs. */
		rua: string[];
		/** Every field as written, extensions included. */
		fields: { [name: string]: string };
	}

	/**
	 * What discovery found at `_smtp._tls.<domain>`: no record, exactly one, or several,
	 * which senders treat as none.
	 */
	export type Discovery =
		| { status: "none"; name: string }
		| { status: "multiple"; name: string; count: number }
		| { status: "invalid"; name: string; error: RecordParseError }
		| { status: "found"; name: string; record: Record };
}

/**
 * Whether a TXT record announces itself as TLS-RPT; records at `_smtp._tls` that do not
 * are discarded before the one-record rule applies.
 */
export function isTlsRptRecord(text: string): boolean {
	return /^v=TLSRPTv1\s*(?:;|$)/.test(text);
}

/**
 * Parses a TLS-RPT record. It must start with `v=TLSRPTv1` and carry a `rua` of absolute
 * URIs; unknown fields are kept and otherwise ignored, and a repeated field keeps its first value.
 *
 * @param text - The TXT record, its character-strings concatenated.
 * @returns The policy, or why senders would ignore it.
 * @example parseTlsRptRecord("v=TLSRPTv1;rua=mailto:reports@example.com")
 */
export function parseTlsRptRecord(text: string): Result<TLSRPT.Record, RecordParseError> {
	if (!isTlsRptRecord(text)) return invalid("The record does not start with `v=TLSRPTv1`");

	let tags = splitTags(text);
	if (tags === null) return invalid("A field is missing its `=`");

	let fields: { [name: string]: string } = {};
	for (let tag of tags.slice(1)) {
		if (!FIELD_NAME.test(tag.name)) return invalid(`\`${tag.name}\` is not a field name`);
		if (!Object.hasOwn(fields, tag.name)) fields[tag.name] = tag.value;
	}

	let rua = fields["rua"];
	if (rua === undefined) return invalid("The record has no `rua` field");
	let uris = splitUriList(rua);
	if (uris.length === 0) return invalid("`rua` lists no URI");
	let bad = uris.find((uri) => !isAbsoluteUri(uri));
	if (bad !== undefined) return invalid(`\`${bad}\` in \`rua\` is not a URI`);

	return success({ rua: uris, fields: { v: "TLSRPTv1", ...fields } });
}

/**
 * Looks up the TLS-RPT policy a domain publishes, applying RFC 8460's selection: records
 * that are not `v=TLSRPTv1` are discarded, and anything but exactly one remaining record
 * means the domain does not take reports.
 *
 * @param domain - The policy domain.
 * @param options - Resolver, signal and timeout.
 * @returns What discovery found, or the DNS failure that left it unknown.
 * @example await discoverTlsRpt("example.com")
 */
export async function discoverTlsRpt(
	domain: string,
	options: LookupOptions = {},
): Promise<Result<TLSRPT.Discovery, DoHError>> {
	let name = `_smtp._tls.${normalizeDomain(domain)}`;
	let texts = await lookupTxt(name, options);
	if (isFailure(texts)) return texts;

	let candidates = texts.data.filter(isTlsRptRecord);
	let [text] = candidates;
	if (text === undefined) return success({ status: "none", name });
	if (candidates.length > 1) {
		return success({ status: "multiple", name, count: candidates.length });
	}

	let record = parseTlsRptRecord(text);
	if (isFailure(record)) return success({ status: "invalid", name, error: record.error });
	return success({ status: "found", name, record: record.data });
}

/** The failure for a record senders ignore. */
function invalid(message: string): Result<never, RecordParseError> {
	return failure(new RecordParseError("tls-rpt", message));
}
