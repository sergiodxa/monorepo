/**
 * Brand Indicators for Message Identification (draft-brand-indicators-for-message-identification-14):
 * the `<selector>._bimi` assertion record with its logo and evidence URLs, its discovery
 * with the Organizational Domain fallback, and the DMARC enforcement it requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DoHError } from "@sdxc/doh";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { DMARC } from "./dmarc.js";
import type { LookupOptions } from "./lookup.js";

import { findOrganizationalDomain } from "./dmarc.js";
import { RecordParseError } from "./errors.js";
import { lookupTxt, normalizeDomain } from "./lookup.js";
import { splitTags } from "./tag-list.js";

/** A local-part prefix in `lps=`: letters, digits and dashes. */
const LOCAL_PART_PREFIX = /^[A-Za-z0-9-]{1,63}$/;

/** Image suffixes other than SVG, which make an `l=` URL a permanent error. */
const OTHER_IMAGE_SUFFIX = /\.(?:png|jpe?g|gif|webp|bmp|ico|tiff?|avif|heic)$/i;

/** Groups the BIMI types under one import surface. */
export namespace BIMI {
	/** A BIMI Assertion Record. */
	export interface Record {
		/** The `l=` logo URL, `null` when empty. */
		location: string | null;
		/** The `a=` evidence document (a VMC or CMC) URL, `null` when empty or absent. */
		evidence: string | null;
		/** Both `l=` and `a=` empty: the domain explicitly declines BIMI for this selector. */
		declined: boolean;
		/** The `lps=` prefixes; `null` without the tag, empty when every local-part matches. */
		localPartPrefixes: string[] | null;
		/**
		 * `avp=`: which picture to prefer when the sender also has a personal avatar.
		 *
		 * @default "brand"
		 */
		avatarPreference: "brand" | "personal";
		/** Every tag as written, unknown ones included. */
		tags: { [name: string]: string };
	}

	/** What discovery found, and at which domain. */
	export type Discovery =
		| { status: "none"; name: string }
		| { status: "multiple"; name: string; count: number }
		| { status: "invalid"; name: string; error: RecordParseError }
		| { status: "found"; name: string; record: Record };

	/** Options for discovery. */
	export interface DiscoverOptions extends LookupOptions {
		/** @default "default" */
		selector?: string;
		/** The Author Domain's Organizational Domain, when already known, which saves a Tree Walk. */
		organizationalDomain?: string;
	}

	/** Why a domain's DMARC policy does not qualify it for BIMI. */
	export type DmarcShortfall =
		| "no-policy"
		| "policy-none"
		| "subdomain-policy-none"
		| "testing"
		| "partial-pct";
}

/** Whether a TXT record identifies itself as BIMI: `v=BIMI1` as its first tag. */
export function isBimiRecord(text: string): boolean {
	return /^v[ \t]*=[ \t]*BIMI1[ \t]*(?:;|$)/.test(text);
}

/**
 * Parses a BIMI Assertion Record. Receivers fix nothing, so a missing `l=`, a URL that is
 * not HTTPS with a domain name, a non-SVG logo suffix, a malformed `lps=` prefix or a
 * repeated tag fails. An unrecognized `avp=` reads as `brand`; unknown tags are ignored.
 *
 * @param text - The TXT record, its character-strings concatenated.
 * @returns The record, or why receivers ignore it.
 * @example parseBimiRecord("v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem")
 */
export function parseBimiRecord(text: string): Result<BIMI.Record, RecordParseError> {
	if (!isBimiRecord(text)) return invalid("The record does not start with `v=BIMI1`");

	let tags = splitTags(text);
	if (tags === null) return invalid("A tag is missing its `=`");

	let values: { [name: string]: string } = {};
	for (let tag of tags) {
		if (Object.hasOwn(values, tag.name)) return invalid(`The \`${tag.name}\` tag appears twice`);
		values[tag.name] = tag.value;
	}

	let location = values["l"];
	if (location === undefined) return invalid("The record has no `l=` tag");
	if (location !== "" && !isHttpsUri(location)) return invalid("`l=` must be one HTTPS URL");
	if (location !== "" && OTHER_IMAGE_SUFFIX.test(new URL(location).pathname)) {
		return invalid("`l=` must point at an SVG logo");
	}

	let evidence = values["a"] ?? "";
	if (evidence !== "" && !isHttpsUri(evidence)) return invalid("`a=` must be one HTTPS URL");

	let lps = values["lps"];
	let localPartPrefixes = lps === undefined ? null : lps.split(",").map((prefix) => prefix.trim());
	if (localPartPrefixes?.length === 1 && localPartPrefixes[0] === "") localPartPrefixes = [];
	if (localPartPrefixes?.some((prefix) => !LOCAL_PART_PREFIX.test(prefix))) {
		return invalid("`lps=` prefixes are letters, digits and dashes");
	}

	return success({
		location: location || null,
		evidence: evidence || null,
		declined: location === "" && evidence === "",
		localPartPrefixes,
		avatarPreference: values["avp"] === "personal" ? "personal" : "brand",
		tags: values,
	});
}

/**
 * Looks up a domain's BIMI Assertion Record: `<selector>._bimi.<domain>`, then the same
 * selector at the Organizational Domain when the domain publishes none. Several records
 * at the name that answered mean BIMI does not apply.
 *
 * @param domain - The Author Domain.
 * @param options - The selector, a known Organizational Domain, and lookup options.
 * @returns What discovery found, or the DNS failure that left it unknown.
 * @example await discoverBimi("example.com")
 */
export async function discoverBimi(
	domain: string,
	options: BIMI.DiscoverOptions = {},
): Promise<Result<BIMI.Discovery, DoHError>> {
	let author = normalizeDomain(domain);
	let selector = normalizeDomain(options.selector ?? "default");

	let own = await discoverAt(`${selector}._bimi.${author}`, options);
	if (isFailure(own) || own.data.status !== "none") return own;

	let organization = options.organizationalDomain;
	if (organization === undefined) {
		let found = await findOrganizationalDomain(author, options);
		if (isFailure(found)) return found;
		organization = found.data;
	}
	organization = normalizeDomain(organization);
	if (organization === author) return own;
	return discoverAt(`${selector}._bimi.${organization}`, options);
}

/**
 * Whether a DMARC discovery meets BIMI's authentication requirements (§7.1, read against
 * RFC 9989): an applied policy of `quarantine` or `reject`, and neither the Author nor the
 * Organizational Domain's record at `p=none`, `sp=none`, `t=y` or a `pct` below 100.
 *
 * @param discovery - The Author Domain's DMARC discovery.
 * @returns Every shortfall, empty when the policy qualifies.
 * @example bimiDmarcShortfalls(discovery) // ["testing"]
 */
export function bimiDmarcShortfalls(discovery: DMARC.Discovery): BIMI.DmarcShortfall[] {
	if (discovery.record === null || discovery.policy === null) return ["no-policy"];

	let records = discovery.found
		.filter(
			(entry) =>
				entry.domain === discovery.domain || entry.domain === discovery.organizationalDomain,
		)
		.map((entry) => entry.record);
	if (records.length === 0) records = [discovery.record];

	let shortfalls = new Set<BIMI.DmarcShortfall>();
	if (discovery.policy === "none") shortfalls.add("policy-none");
	for (let record of records) {
		if (record.policy === "none") shortfalls.add("policy-none");
		if (record.subdomainPolicy === "none") shortfalls.add("subdomain-policy-none");
		if (record.testing) shortfalls.add("testing");
		let pct = record.tags["pct"];
		if (pct !== undefined && pct.trim() !== "100") shortfalls.add("partial-pct");
	}
	return [...shortfalls];
}

/** Applies BIMI's record selection at one name. */
async function discoverAt(
	name: string,
	options: LookupOptions,
): Promise<Result<BIMI.Discovery, DoHError>> {
	let texts = await lookupTxt(name, options);
	if (isFailure(texts)) return texts;

	let candidates = texts.data.filter(isBimiRecord);
	let [text] = candidates;
	if (text === undefined) return success({ status: "none", name });
	if (candidates.length > 1) return success({ status: "multiple", name, count: candidates.length });

	let record = parseBimiRecord(text);
	if (isFailure(record)) return success({ status: "invalid", name, error: record.error });
	return success({ status: "found", name, record: record.data });
}

/** Whether `value` is a single absolute HTTPS URL naming a host by domain. */
function isHttpsUri(value: string): boolean {
	if (value.includes(",") || !URL.canParse(value)) return false;
	let url = new URL(value);
	return (
		url.protocol === "https:" && url.hostname.includes(".") && !/^[\d.]+$|^\[/.test(url.hostname)
	);
}

/** The failure for a record receivers ignore. */
function invalid(message: string): Result<never, RecordParseError> {
	return failure(new RecordParseError("bimi", message));
}
