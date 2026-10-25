/**
 * DMARC as RFC 9989 defines it: the `_dmarc` policy record with its `np`, `psd` and `t`
 * tags, the DNS Tree Walk that replaced the public suffix list, policy discovery, and the
 * Organizational Domain that relaxed identifier alignment compares.
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

/** The query cap the Tree Walk keeps to: a long name is shortened to this many labels first. */
const MAX_WALK_LABELS = 7;

/** The values `p`, `sp` and `np` take. */
const POLICIES = new Set(["none", "quarantine", "reject"]);

/** RFC 9989 §4.8's `dmarc-fo`, each of `d` and `s` at most once. */
const FAILURE_OPTIONS = /^[01ds](?::[01ds])*$/;

/** Groups the DMARC types under one import surface. */
export namespace DMARC {
	/** A Domain Owner Assessment Policy. */
	export type Policy = "none" | "quarantine" | "reject";

	/** How closely an authenticated identifier must match the Author Domain. */
	export type AlignmentMode = "relaxed" | "strict";

	/**
	 * The `psd` tag: `y` marks a Public Suffix Domain, `n` an Organizational Domain, and
	 * `u` leaves the Tree Walk to decide.
	 */
	export type PublicSuffixFlag = "y" | "n" | "u";

	/** One `fo` failure-reporting option. */
	export type FailureOption = "0" | "1" | "d" | "s";

	/** A tag whose value a receiver discards as a syntax error, keeping the default instead. */
	export interface Issue {
		tag: string;
		value: string;
	}

	/** A DMARC Policy Record, every absent or discarded tag read as its default. */
	export interface Record {
		/** `p`; `null` when absent or invalid, which `appliedDmarcPolicy` resolves. */
		policy: Policy | null;
		/** `sp`, for existing subdomains of an Organizational Domain. */
		subdomainPolicy: Policy | null;
		/** `np`, for subdomains that do not exist. */
		nonExistentPolicy: Policy | null;
		/**
		 * `adkim`.
		 *
		 * @default "relaxed"
		 */
		dkimAlignment: AlignmentMode;
		/**
		 * `aspf`.
		 *
		 * @default "relaxed"
		 */
		spfAlignment: AlignmentMode;
		/**
		 * `psd`.
		 *
		 * @default "u"
		 */
		psd: PublicSuffixFlag;
		/** `t=y`: receivers apply one level below the policy while the owner tests it. */
		testing: boolean;
		/**
		 * `fo`, meaningful only with `ruf`.
		 *
		 * @default ["0"]
		 */
		failureOptions: FailureOption[];
		/** Aggregate report destinations, with any obsolete `!size` suffix removed. */
		rua: string[];
		/** Failure report destinations. */
		ruf: string[];
		/** Every tag as written, unknown ones included. */
		tags: { [name: string]: string };
		/** Values discarded as syntax errors, in record order. */
		issues: Issue[];
	}

	/** Where in the namespace an applied policy came from. */
	export type PolicySource = "author-domain" | "organizational-domain" | "public-suffix-domain";

	/** What one `_dmarc` query of a walk found. */
	export interface Lookup {
		/** The domain whose `_dmarc` name was queried. */
		domain: string;
		/** `multiple` means several DMARC records, which are all discarded. */
		found: "none" | "record" | "multiple";
	}

	/** A valid record found during a walk and the domain it was published for. */
	export interface Found {
		domain: string;
		record: Record;
	}

	/** The outcome of policy discovery for one Author Domain. */
	export interface Discovery {
		domain: string;
		/** Every query the walk made, in order. */
		lookups: Lookup[];
		/** The valid records found, longest name first. */
		found: Found[];
		/** The domain relaxed alignment compares against. */
		organizationalDomain: string;
		/** The record that applies to `domain`, `null` when DMARC does not apply to it. */
		record: Record | null;
		/** Where `record` was published, `null` without one. */
		policyDomain: string | null;
		source: PolicySource | null;
		/**
		 * The policy a receiver applies to failing mail from `domain` when it exists, or
		 * `null` when no DMARC processing applies.
		 */
		policy: Policy | null;
	}

	/** Which names a policy is applied to. */
	export type PolicyScope = "domain" | "subdomain" | "non-existent-subdomain";
}

/**
 * Whether a TXT record identifies itself as DMARC: `v=DMARC1` as its first tag, case
 * sensitive. Every other record at a `_dmarc` name is discarded before counting.
 */
export function isDmarcRecord(text: string): boolean {
	return /^v[ \t]*=[ \t]*DMARC1[ \t]*(?:;|$)/.test(text);
}

/**
 * Parses a DMARC Policy Record. Only a missing or misplaced `v=DMARC1` fails; any other
 * invalid value is discarded in favor of its default and listed in `issues`, and unknown
 * tags are ignored, as receivers do.
 *
 * @param text - The TXT record, its character-strings concatenated.
 * @returns The record, or why receivers ignore it entirely.
 * @example parseDmarcRecord("v=DMARC1; p=none; rua=mailto:dmarc-feedback@example.com")
 */
export function parseDmarcRecord(text: string): Result<DMARC.Record, RecordParseError> {
	if (!isDmarcRecord(text)) {
		return failure(new RecordParseError("dmarc", "The record does not start with `v=DMARC1`"));
	}

	let tags: { [name: string]: string } = {};
	let issues: DMARC.Issue[] = [];
	for (let tag of splitTags(text) ?? splitLenient(text)) {
		if (Object.hasOwn(tags, tag.name)) issues.push({ tag: tag.name, value: tag.value });
		else tags[tag.name] = tag.value;
	}

	let read = <Value extends string>(name: string, valid: (value: string) => boolean) => {
		let value = tags[name];
		if (value === undefined) return null;
		if (valid(value)) return value as Value;
		issues.push({ tag: name, value });
		return null;
	};

	let isPolicy = (value: string) => POLICIES.has(value);
	let isMode = (value: string) => value === "r" || value === "s";
	let isFlag = (value: string) => value === "y" || value === "n";

	let order = Object.keys(tags);
	let fo = read<string>("fo", (value) => FAILURE_OPTIONS.test(value) && validFailureOptions(value));

	return success({
		policy: read<DMARC.Policy>("p", isPolicy),
		subdomainPolicy: read<DMARC.Policy>("sp", isPolicy),
		nonExistentPolicy: read<DMARC.Policy>("np", isPolicy),
		dkimAlignment: read("adkim", isMode) === "s" ? "strict" : "relaxed",
		spfAlignment: read("aspf", isMode) === "s" ? "strict" : "relaxed",
		psd: read<DMARC.PublicSuffixFlag>("psd", (value) => isFlag(value) || value === "u") ?? "u",
		testing: read("t", isFlag) === "y",
		failureOptions: fo === null ? ["0"] : (fo.split(":") as DMARC.FailureOption[]),
		rua: reportUris("rua", tags, issues),
		ruf: reportUris("ruf", tags, issues),
		tags,
		issues: issues.sort((one, other) => order.indexOf(one.tag) - order.indexOf(other.tag)),
	});
}

/**
 * The policy a receiver applies to `scope` under a record (RFC 9989 §4.7, §4.10.1): `np`
 * falls back to `sp`, `sp` to `p`. A missing or invalid `p`, or an invalid `sp`/`np`,
 * reads as `none` when `rua` names a report destination, and as no DMARC at all otherwise.
 *
 * @param record - The record that applies.
 * @param scope - Whether the mail's domain is the record's own, an existing subdomain, or a missing one.
 * @returns The policy, or `null` when receivers apply no DMARC processing.
 * @example appliedDmarcPolicy(record, "subdomain") // "quarantine"
 */
export function appliedDmarcPolicy(
	record: DMARC.Record,
	scope: DMARC.PolicyScope = "domain",
): DMARC.Policy | null {
	let discarded = new Set(record.issues.map((issue) => issue.tag));
	if (record.policy === null || discarded.has("sp") || discarded.has("np")) {
		return record.rua.length > 0 ? "none" : null;
	}
	if (scope === "domain") return record.policy;
	if (scope === "subdomain") return record.subdomainPolicy ?? record.policy;
	return record.nonExistentPolicy ?? record.subdomainPolicy ?? record.policy;
}

/**
 * The domains whose `_dmarc` names a DNS Tree Walk queries, in order (RFC 9989 §4.10):
 * the domain itself, then its ancestors one label at a time, with a name of eight or more
 * labels shortened to seven first so no walk exceeds eight queries.
 *
 * @param domain - Where the walk starts.
 * @example dmarcTreeWalk("a.mail.example.com") // ["a.mail.example.com", "mail.example.com", "example.com", "com"]
 */
export function dmarcTreeWalk(domain: string): string[] {
	let labels = normalizeDomain(domain).split(".");
	let names = [labels.join(".")];
	let rest = labels.length > MAX_WALK_LABELS ? labels.slice(-MAX_WALK_LABELS) : labels.slice(1);
	while (rest.length > 0) {
		names.push(rest.join("."));
		rest = rest.slice(1);
	}
	return names;
}

/**
 * Runs a DNS Tree Walk from `domain`, querying each `_dmarc` name until a record with
 * `psd=y` or `psd=n` stops it or the labels run out. A name with several DMARC records
 * counts as having none.
 *
 * @param domain - Where the walk starts.
 * @param options - Resolver, signal and timeout.
 * @returns Every query made and the valid records found, longest name first.
 */
export async function walkDmarcTree(
	domain: string,
	options: LookupOptions = {},
): Promise<Result<{ lookups: DMARC.Lookup[]; found: DMARC.Found[] }, DoHError>> {
	let lookups: DMARC.Lookup[] = [];
	let found: DMARC.Found[] = [];

	for (let name of dmarcTreeWalk(domain)) {
		let texts = await lookupTxt(`_dmarc.${name}`, options);
		if (isFailure(texts)) return texts;

		let candidates = texts.data.filter(isDmarcRecord);
		let [text] = candidates;
		if (text === undefined || candidates.length > 1) {
			lookups.push({ domain: name, found: text === undefined ? "none" : "multiple" });
			continue;
		}

		let record = parseDmarcRecord(text);
		if (isFailure(record)) continue;
		lookups.push({ domain: name, found: "record" });
		found.push({ domain: name, record: record.data });
		if (record.data.psd !== "u") break;
	}

	return success({ lookups, found });
}

/**
 * Selects the Organizational Domain from a walk's records (RFC 9989 §4.10.2): the first
 * `psd=n` domain; else the domain one label below the first `psd=y` other than the start;
 * else the record with the fewest labels; else the start itself.
 *
 * @param domain - Where the walk started.
 * @param found - The walk's valid records, longest name first.
 * @example selectOrganizationalDomain("a.mail.example.com", found) // "example.com"
 */
export function selectOrganizationalDomain(domain: string, found: readonly DMARC.Found[]): string {
	let start = normalizeDomain(domain);

	let organization = found.find((entry) => entry.record.psd === "n");
	if (organization) return organization.domain;

	let suffix = found.find((entry) => entry.record.psd === "y" && entry.domain !== start);
	if (suffix) {
		let depth = suffix.domain.split(".").length + 1;
		return start.split(".").slice(-depth).join(".");
	}

	let shortest = found.at(-1);
	return shortest ? shortest.domain : start;
}

/**
 * Discovers the DMARC policy for mail from `domain` (RFC 9989 §4.10.1): the domain's own
 * record first, then the Organizational Domain's, then the Public Suffix Domain's, read
 * with `sp` for a subdomain. A DNS failure is returned rather than read as no policy.
 *
 * @param domain - The Author Domain.
 * @param options - Resolver, signal and timeout.
 * @returns The applicable record and policy, or the DNS failure that left them unknown.
 * @example await discoverDmarc("example.com")
 */
export async function discoverDmarc(
	domain: string,
	options: LookupOptions = {},
): Promise<Result<DMARC.Discovery, DoHError>> {
	let name = normalizeDomain(domain);
	let walk = await walkDmarcTree(name, options);
	if (isFailure(walk)) return walk;

	let { lookups, found } = walk.data;
	let organizationalDomain = selectOrganizationalDomain(name, found);
	let applied = applicableRecord(name, organizationalDomain, found);

	return success({
		domain: name,
		lookups,
		found,
		organizationalDomain,
		record: applied?.record ?? null,
		policyDomain: applied?.domain ?? null,
		source: applied?.source ?? null,
		policy: policyFor(applied, name),
	});
}

/**
 * The Organizational Domain of `domain`, found by its own Tree Walk.
 *
 * @param domain - Any domain: an Author Domain, an SPF or DKIM identifier.
 * @param options - Resolver, signal and timeout.
 * @example await findOrganizationalDomain("signing.example.com") // "example.com"
 */
export async function findOrganizationalDomain(
	domain: string,
	options: LookupOptions = {},
): Promise<Result<string, DoHError>> {
	let walk = await walkDmarcTree(domain, options);
	if (isFailure(walk)) return walk;
	return success(selectOrganizationalDomain(domain, walk.data.found));
}

/**
 * Whether an authenticated identifier aligns with the Author Domain: identical under
 * strict mode, sharing an Organizational Domain under relaxed mode. Identical names align
 * without a lookup.
 *
 * @param authorDomain - The RFC5322.From domain.
 * @param identifier - The SPF-authenticated MAIL FROM domain or a DKIM `d=` domain.
 * @param mode - The record's `aspf` or `adkim`.
 * @param options - Resolver, signal and timeout.
 * @example await isAligned("example.com", "signing.example.com", "relaxed") // true
 */
export async function isAligned(
	authorDomain: string,
	identifier: string,
	mode: DMARC.AlignmentMode,
	options: LookupOptions = {},
): Promise<Result<boolean, DoHError>> {
	let author = normalizeDomain(authorDomain);
	let other = normalizeDomain(identifier);
	if (author === other) return success(true);
	if (mode === "strict") return success(false);

	let authorOrganization = await findOrganizationalDomain(author, options);
	if (isFailure(authorOrganization)) return authorOrganization;
	let otherOrganization = await findOrganizationalDomain(other, options);
	if (isFailure(otherOrganization)) return otherOrganization;
	return success(authorOrganization.data === otherOrganization.data);
}

/** The record that applies to `domain` and where it came from, or `null` when none does. */
function applicableRecord(
	domain: string,
	organizationalDomain: string,
	found: readonly DMARC.Found[],
): (DMARC.Found & { source: DMARC.PolicySource }) | null {
	let own = found.find((entry) => entry.domain === domain);
	if (own) return { ...own, source: "author-domain" };

	let organization = found.find((entry) => entry.domain === organizationalDomain);
	if (organization) return { ...organization, source: "organizational-domain" };

	let suffix = found.find((entry) => entry.record.psd === "y");
	if (suffix) return { ...suffix, source: "public-suffix-domain" };
	return null;
}

/** The policy an existing `domain` receives from the applicable record. */
function policyFor(
	applied: (DMARC.Found & { source: DMARC.PolicySource }) | null,
	domain: string,
): DMARC.Policy | null {
	if (applied === null) return null;
	return appliedDmarcPolicy(applied.record, applied.domain === domain ? "domain" : "subdomain");
}

/** Whether an `fo` value names each option once and never both `0` and `1`. */
function validFailureOptions(value: string): boolean {
	let options = value.split(":");
	if (new Set(options).size !== options.length) return false;
	return !(options.includes("0") && options.includes("1"));
}

/**
 * The report URIs a `rua` or `ruf` tag lists, the obsolete `!size` suffix removed. A list
 * holding any URI that does not parse is discarded whole and recorded as an issue.
 */
function reportUris(
	name: "rua" | "ruf",
	tags: { [name: string]: string },
	issues: DMARC.Issue[],
): string[] {
	let value = tags[name];
	if (value === undefined) return [];
	let uris = splitUriList(value).map((uri) => uri.replace(/![0-9]+[kmgt]?$/i, ""));
	if (uris.length > 0 && uris.every(isAbsoluteUri)) return uris;
	issues.push({ tag: name, value });
	return [];
}

/**
 * Reads the well-formed tags of a record that has a segment without `=`, since a DMARC
 * syntax error discards only the broken part.
 */
function splitLenient(text: string): { name: string; value: string }[] {
	return text
		.split(";")
		.filter((segment) => segment.includes("="))
		.map((segment) => {
			let equals = segment.indexOf("=");
			return { name: segment.slice(0, equals).trim(), value: segment.slice(equals + 1).trim() };
		});
}
