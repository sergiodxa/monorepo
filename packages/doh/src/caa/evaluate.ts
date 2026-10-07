/**
 * Decides a certificate request against one CAA RRset under RFC 8659 and RFC 8657, with no
 * I/O, so records read from a zone file decide exactly as records from a resolver do: the
 * `issuewild` override, additive authorizations, critical tags and the account and method bindings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CAA } from "./types.js";

import { parseCaaProperty } from "./property.js";

/** RFC 8657 §4's `validationmethods` value: comma-separated method labels. */
const METHOD_LIST = /^[A-Za-z0-9](?:-*[A-Za-z0-9])*(?:,[A-Za-z0-9](?:-*[A-Za-z0-9])*)*$/;

/**
 * Decides a request against one RRset. A critical unknown tag refuses before anything
 * else; for a wildcard domain any `issuewild` replaces every `issue`; issuers match
 * exactly, case-insensitively and without the trailing dot. Reserved flag bits are ignored.
 *
 * @param records - The relevant RRset, such as `findRelevantCaa`'s records or a zone file's.
 * @param request - The domain, the CA's identifiers and, optionally, the RFC 8657 account and method.
 * @returns Whether the RRset allows the request, and which property or issuers decided it.
 * @example evaluateCaa([{ type: "CAA", flags: 0, critical: false, tag: "issue", value: "pki.goog" }], { domain: "example.com", issuer: "letsencrypt.org" }) // { allowed: false, reason: "not-authorized", issuers: ["pki.goog"] }
 */
export function evaluateCaa(records: readonly CAA.Record[], request: CAA.Request): CAA.Decision {
	if (records.length === 0) return { allowed: true, reason: "no-policy" };

	let properties = records.map(parseCaaProperty);
	let critical = properties.find(
		(property): property is CAA.UnknownProperty => property.kind === "unknown" && property.critical,
	);
	if (critical) return { allowed: false, reason: "critical-tag", property: critical };

	let applicable = applicableProperties(properties, request.domain);
	if (applicable.length === 0) return { allowed: true, reason: "unrestricted" };

	let issuers = new Set([request.issuer].flat().map(normalizeIssuer));
	let matching = applicable.filter(
		(property) => property.issuer !== null && issuers.has(property.issuer),
	);

	let authorized = matching.find(
		(property) => accountSatisfied(property, request) && methodSatisfied(property, request),
	);
	if (authorized) return { allowed: true, reason: "authorized", property: authorized };

	let [first] = matching;
	if (first) {
		let reason = accountSatisfied(first, request)
			? ("validation-method-mismatch" as const)
			: ("account-mismatch" as const);
		return { allowed: false, reason, property: first };
	}

	let named = applicable.flatMap((property) => (property.issuer === null ? [] : [property.issuer]));
	if (named.length > 0)
		return { allowed: false, reason: "not-authorized", issuers: [...new Set(named)] };
	return { allowed: false, reason: "forbidden" };
}

/**
 * The properties that decide `domain` (RFC 8659 §4.3): `issuewild` for a wildcard name
 * that has any, otherwise `issue`; a non-wildcard name never reads `issuewild`.
 */
function applicableProperties(properties: CAA.Property[], domain: string): CAA.IssueProperty[] {
	let issue = properties.filter(
		(property): property is CAA.IssueProperty => property.kind === "issue",
	);
	if (!domain.trim().startsWith("*.")) return issue;
	let wild = properties.filter(
		(property): property is CAA.IssueProperty => property.kind === "issuewild",
	);
	return wild.length > 0 ? wild : issue;
}

/** Folds a CA identifier the way `parseCaaProperty` folds an issuer. */
function normalizeIssuer(issuer: string): string {
	let lower = issuer.trim().toLowerCase();
	return lower.endsWith(".") ? lower.slice(0, -1) : lower;
}

/** The values of every parameter named `key`, in published order. */
function parameterValues(property: CAA.IssueProperty, key: string): string[] {
	return property.parameters
		.filter((parameter) => parameter.key === key)
		.map((parameter) => parameter.value);
}

/**
 * RFC 8657 §3: one `accounturi` binds the property to that account, and two or more
 * make it unsatisfiable. A request with no `accountUri` passes a single binding.
 */
function accountSatisfied(property: CAA.IssueProperty, request: CAA.Request): boolean {
	let accounts = parameterValues(property, "accounturi");
	if (accounts.length === 0) return true;
	if (accounts.length > 1) return false;
	return request.accountUri === undefined || accounts[0] === request.accountUri;
}

/**
 * RFC 8657 §4: `validationmethods` binds the property to the listed methods. An empty,
 * malformed or repeated list is unsatisfiable; a request with no method passes a valid list.
 */
function methodSatisfied(property: CAA.IssueProperty, request: CAA.Request): boolean {
	let lists = parameterValues(property, "validationmethods");
	if (lists.length === 0) return true;
	let [list] = lists;
	if (lists.length > 1 || list === undefined || !METHOD_LIST.test(list)) return false;
	return (
		request.validationMethod === undefined || list.split(",").includes(request.validationMethod)
	);
}
