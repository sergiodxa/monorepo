import type { ZoneFile } from "@sdxc/zone-file";

/**
 * The types of the CAA policy reading: what one record asks of a CA, the RRset RFC 8659
 * applies to a name, the certificate request to decide, and the verdict, every one plain
 * data but the lookup failure, so a verdict can be logged or stored as is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DoHError } from "../errors.js";
import type { DoH } from "../types.js";

/**
 * Groups the CAA policy types under a single import surface.
 */
export namespace CAA {
	/** One CAA record's data, from an answer or from `parseRecordData("CAA", …)` on a zone-file line. */
	export type Record = ZoneFile.CAAData;

	/** One `key=value` from an `issue` or `issuewild` value, in published order. */
	export interface Parameter {
		key: string;
		value: string;
	}

	/** An `issue` or `issuewild` property. */
	export interface IssueProperty {
		kind: "issue" | "issuewild";
		critical: boolean;
		/** The issuer domain, lowercased; `null` forbids issuance, as an empty or malformed value does. */
		issuer: string | null;
		/** The value failed RFC 8659's grammar, which forbids issuance the way an empty issuer does. */
		malformed: boolean;
		parameters: Parameter[];
	}

	/** Where a CA reports a refused or violating request. */
	export interface IodefProperty {
		kind: "iodef";
		critical: boolean;
		/** The value when it parses as a `mailto:`, `http:` or `https:` URL, `null` otherwise. */
		url: string | null;
	}

	/** A property this package does not interpret; with `critical` set it forbids issuance. */
	export interface UnknownProperty {
		kind: "unknown";
		critical: boolean;
		tag: string;
		value: string;
	}

	/** What one CAA record asks of a CA. */
	export type Property = IssueProperty | IodefProperty | UnknownProperty;

	/** The RRset RFC 8659 §3 applies to a domain, and how it was found. */
	export interface RelevantSet {
		/** The name whose query returned the records, the domain or an ancestor; `null` when none did. */
		name: string | null;
		records: DoH.CAARecord[];
		/** Records of the set whose data did not parse; a CA cannot satisfy a set it cannot read. */
		unparsed: DoH.UnknownRecord[];
		/** Aliases the resolver followed for `name`; the records are owned by the chain's end. */
		chain: DoH.CNAMERecord[];
		/** Every name queried, nearest first. */
		queried: string[];
		/** Every answer in the climb carried the AD flag, denials of existence included. */
		authenticated: boolean;
	}

	/** A certificate request to decide. */
	export interface Request {
		/** The name on the certificate; `*.example.com` asks about a wildcard certificate. */
		domain: string;
		/** The CA's CAA identifiers, such as `letsencrypt.org`; any one matching authorizes. */
		issuer: string | readonly string[];
		/** RFC 8657 `accounturi` of the requesting account; omitted, the check is skipped. */
		accountUri?: string;
		/** RFC 8657 method label, such as `dns-01`; omitted, the check is skipped. */
		validationMethod?: string;
	}

	/** The domain and its ancestors publish no CAA record, so any CA may issue. */
	export interface NoPolicy {
		allowed: true;
		reason: "no-policy";
	}

	/** The RRset holds no property that applies to the request, such as only `iodef`. */
	export interface Unrestricted {
		allowed: true;
		reason: "unrestricted";
	}

	/** `property` names one of the request's issuers and its parameters are satisfied. */
	export interface Authorized {
		allowed: true;
		reason: "authorized";
		property: IssueProperty;
	}

	/** Every applicable property names no issuer: the policy forbids issuance outright. */
	export interface Forbidden {
		allowed: false;
		reason: "forbidden";
	}

	/** The applicable properties name issuers, none of them the request's. */
	export interface NotAuthorized {
		allowed: false;
		reason: "not-authorized";
		/** The issuers the applicable properties do name, for a message the owner can act on. */
		issuers: string[];
	}

	/** `property` names the request's issuer, and its RFC 8657 parameters exclude the request. */
	export interface ParameterMismatch {
		allowed: false;
		reason: "account-mismatch" | "validation-method-mismatch";
		property: IssueProperty;
	}

	/** `property` is critical and of a kind no CA here is known to understand. */
	export interface CriticalTag {
		allowed: false;
		reason: "critical-tag";
		property: UnknownProperty;
	}

	/** The relevant RRset holds a record whose data does not parse. */
	export interface Unreadable {
		allowed: false;
		reason: "unreadable";
		record: DoH.UnknownRecord;
	}

	/** A query in the climb failed, which a CA reads as a refusal (RFC 8659 §6). */
	export interface LookupFailed {
		allowed: false;
		reason: "lookup-failed";
		/** The name whose query failed. */
		name: string;
		queried: string[];
		error: DoHError;
	}

	/** Where a verdict's policy came from. */
	export interface Located {
		relevant: RelevantSet;
	}

	/** What one RRset says about one request. */
	export type Decision =
		| NoPolicy
		| Unrestricted
		| Authorized
		| Forbidden
		| NotAuthorized
		| ParameterMismatch
		| CriticalTag;

	/** What DNS says about one request; every failure reads `allowed: false`. */
	export type Verdict = ((Decision | Unreadable) & Located) | LookupFailed;
}
