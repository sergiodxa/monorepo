/**
 * Reads a DKIM key record (RFC 6376 §3.6.1), the TXT record at
 * `<selector>._domainkey.<domain>`: its key type, public key, hash algorithms, service
 * types and flags, with an empty `p=` read as the revoked key it declares.
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
import { splitTags } from "./tag-list.js";

/** RFC 6376 §3.2's `tag-name`: a letter, then letters, digits and underscores. */
const TAG_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Base64 as a key record writes it, whitespace already removed. */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Groups the DKIM key record types under one import surface. */
export namespace DKIM {
	/** A published key, read with the defaults RFC 6376 assigns to every absent tag. */
	export interface KeyRecord {
		/**
		 * The key type (`k=`), lowercased.
		 *
		 * @default "rsa"
		 */
		keyType: string;
		/** The base64 public key (`p=`) with whitespace removed; empty when revoked. */
		publicKey: string;
		/** An empty `p=`: the signer withdrew this key, so signatures under it fail. */
		revoked: boolean;
		/** Acceptable hash algorithms (`h=`); `null` allows every algorithm. */
		hashAlgorithms: string[] | null;
		/**
		 * Service types the key may be used for (`s=`), such as `email` or `tlsrpt`.
		 *
		 * @default ["*"]
		 */
		serviceTypes: string[];
		/** `t=y`: the domain is testing DKIM, so verifiers treat failures as unsigned mail. */
		testing: boolean;
		/** `t=s`: the signing domain must equal the `i=` identity's domain exactly. */
		strict: boolean;
		/** Human-readable notes (`n=`), when published. */
		notes: string | null;
		/** Every tag as written, unknown ones included. */
		tags: Record<string, string>;
	}
}

/**
 * Parses a DKIM key record. `v=`, when present, must be first and `DKIM1`; a repeated tag,
 * a missing `p=` or a key that is not base64 makes the record invalid, as a verifier
 * treats it. Unknown tags are kept in `tags` and otherwise ignored.
 *
 * @param text - The TXT record, its character-strings concatenated.
 * @returns The key record, or why a verifier would ignore it.
 * @example parseDkimRecord("v=DKIM1; k=rsa; s=tlsrpt; p=Mlf4qwSZfase4fa==")
 */
export function parseDkimRecord(text: string): Result<DKIM.KeyRecord, RecordParseError> {
	let tags = splitTags(text);
	if (tags === null) return invalid("A tag is missing its `=`");

	let values: Record<string, string> = {};
	for (let [index, tag] of tags.entries()) {
		if (!TAG_NAME.test(tag.name)) return invalid(`\`${tag.name}\` is not a tag name`);
		if (Object.hasOwn(values, tag.name)) return invalid(`The \`${tag.name}\` tag appears twice`);
		if (tag.name === "v" && (index !== 0 || tag.value !== "DKIM1")) {
			return invalid("`v=` must be the first tag and read `DKIM1`");
		}
		values[tag.name] = tag.value;
	}

	let publicKey = values["p"];
	if (publicKey === undefined) return invalid("The record has no `p=` tag");
	let key = publicKey.replace(/\s+/g, "");
	if (!BASE64.test(key)) return invalid("`p=` is not base64");

	let flags = colonList(values["t"] ?? "");

	return success({
		keyType: (values["k"] ?? "rsa").toLowerCase(),
		publicKey: key,
		revoked: key === "",
		hashAlgorithms: values["h"] === undefined ? null : colonList(values["h"]),
		serviceTypes: values["s"] === undefined ? ["*"] : colonList(values["s"]),
		testing: flags.includes("y"),
		strict: flags.includes("s"),
		notes: values["n"] ?? null,
		tags: values,
	});
}

/**
 * Looks up and parses the key a selector publishes for a domain. An unpublished selector
 * succeeds with `null`; a record that does not parse is the failure.
 *
 * @param domain - The signing domain (`d=`).
 * @param selector - The selector (`s=`).
 * @param options - Resolver, signal and timeout.
 * @returns The key record, `null` when none is published.
 * @example await lookupDkimKey("example.com", "brisbane")
 */
export async function lookupDkimKey(
	domain: string,
	selector: string,
	options: LookupOptions = {},
): Promise<Result<DKIM.KeyRecord | null, DoHError | RecordParseError>> {
	let name = `${normalizeDomain(selector)}._domainkey.${normalizeDomain(domain)}`;
	let texts = await lookupTxt(name, options);
	if (isFailure(texts)) return texts;
	let [text] = texts.data;
	if (text === undefined) return success(null);
	return parseDkimRecord(text);
}

/** A colon-separated DKIM list, trimmed, with empty entries dropped. */
function colonList(value: string): string[] {
	return value
		.split(":")
		.map((entry) => entry.trim())
		.filter((entry) => entry !== "");
}

/** The failure for a key record a verifier ignores. */
function invalid(message: string): Result<never, RecordParseError> {
	return failure(new RecordParseError("dkim", message));
}
