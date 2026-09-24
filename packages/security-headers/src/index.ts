/**
 * The response policy header set as one typed object: CSP (enforced and Report-Only), HSTS,
 * Referrer-Policy, Permissions-Policy, COOP/COEP/CORP, nosniff and Reporting-Endpoints, turned
 * into header entries an app applies to every response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isSuccess } from "@sdxc/result";
import { stringify as stringifyField } from "@sdxc/structured-fields";

import type { CSP, PermissionsPolicy, SecurityHeaders } from "./lib/types.js";

import { merge, stringify as stringifyCSP } from "./csp.js";
import { stringify as stringifyPermissionsPolicy } from "./permissions-policy.js";

export type { CSP, PermissionsPolicy, SecurityHeaders } from "./lib/types.js";

/** The `max-age` HSTS preload lists require: one year, in seconds. */
const PRELOAD_MIN_MAX_AGE = 31536000;

/** RFC 9651's key grammar, which Permissions-Policy feature names and endpoint names follow. */
const SF_KEY = /^[a-z*][a-z0-9_.*-]*$/;

/** The characters an RFC 9651 String carries: printable ASCII and space. */
const SF_STRING = /^[\x20-\x7e]*$/;

/**
 * Every header the policy produces, `X-Frame-Options` derived from `frameAncestors`. A value
 * this package cannot write is dropped toward the stricter policy: a Permissions-Policy origin
 * RFC 9651 cannot carry denies its feature, and an unwritable CSP source is removed.
 *
 * @param policy - The policy set
 * @param options - The response's nonce and the request URL, whose scheme gates HSTS
 * @returns Lowercase header names and their values, in a stable order
 */
export function entries(
	policy: SecurityHeaders.Policy,
	options: SecurityHeaders.ApplyOptions,
): Array<[name: string, value: string]> {
	let headers: Array<[name: string, value: string]> = [];
	let add = (name: string, value: string | undefined) => {
		if (value !== undefined && value !== "") headers.push([name, value]);
	};
	let cspOptions: CSP.StringifyOptions =
		options.nonce === undefined ? {} : { nonce: options.nonce };

	if (policy.contentSecurityPolicy) {
		add("content-security-policy", stringifyCSP(policy.contentSecurityPolicy, cspOptions));
		add("x-frame-options", frameOptions(policy.contentSecurityPolicy.frameAncestors));
	}
	if (policy.contentSecurityPolicyReportOnly) {
		add(
			"content-security-policy-report-only",
			stringifyCSP(policy.contentSecurityPolicyReportOnly, cspOptions),
		);
	}
	if (policy.strictTransportSecurity && options.url.protocol === "https:") {
		add(
			"strict-transport-security",
			stringifyStrictTransportSecurity(policy.strictTransportSecurity),
		);
	}
	if (policy.referrerPolicy !== undefined) {
		add("referrer-policy", [policy.referrerPolicy].flat().join(", "));
	}
	if (policy.permissionsPolicy) {
		add("permissions-policy", permissionsPolicyValue(policy.permissionsPolicy));
	}
	add("cross-origin-opener-policy", policy.crossOriginOpenerPolicy);
	add("cross-origin-embedder-policy", policy.crossOriginEmbedderPolicy);
	add("cross-origin-embedder-policy-report-only", policy.crossOriginEmbedderPolicyReportOnly);
	add("cross-origin-resource-policy", policy.crossOriginResourcePolicy);
	if (policy.reportingEndpoints) {
		add("reporting-endpoints", reportingEndpointsValue(policy.reportingEndpoints));
	}
	if (policy.noSniff !== false) add("x-content-type-options", "nosniff");

	return headers;
}

/**
 * Writes each header the response has not set for itself, so a route's own value wins. A
 * response carrying its own Content-Security-Policy also gets no derived `X-Frame-Options`,
 * which keeps the two headers from disagreeing.
 *
 * @param headers - The response headers, written in place
 * @param policy - The policy set
 * @param options - The response's nonce and the request URL
 */
export function apply(
	headers: Headers,
	policy: SecurityHeaders.Policy,
	options: SecurityHeaders.ApplyOptions,
): void {
	let ownCSP = headers.has("content-security-policy");
	for (let [name, value] of entries(policy, options)) {
		if (name === "x-frame-options" && ownCSP) continue;
		if (!headers.has(name)) headers.set(name, value);
	}
}

/**
 * Patches a policy: a header set to `null` is removed, a CSP patch is merged directive by
 * directive (its `null`s removing directives), and any other value replaces the base's.
 *
 * @param policy - The base policy, left untouched
 * @param patch - The headers to change for this response or route
 * @returns A new policy
 * @example override(policy, { contentSecurityPolicy: { frameAncestors: ["*"] } })
 */
export function override(
	policy: SecurityHeaders.Policy,
	patch: SecurityHeaders.Override,
): SecurityHeaders.Policy {
	let result: Record<string, unknown> = { ...policy };
	for (let [name, value] of Object.entries(patch)) {
		if (value === undefined) continue;
		if (value === null) {
			delete result[name];
		} else if (name === "contentSecurityPolicy" || name === "contentSecurityPolicyReportOnly") {
			result[name] = merge(
				(result[name] as CSP.Directives | undefined) ?? {},
				value as CSP.Override,
			);
		} else {
			result[name] = value;
		}
	}
	return result as SecurityHeaders.Policy;
}

/**
 * Writes a Strict-Transport-Security value. `preload` is written only with a `maxAge` of a year
 * or more and `includeSubDomains`, since preload lists reject any other combination; `maxAge`
 * is written as whole, non-negative seconds.
 *
 * @param value - The HSTS policy
 * @returns The header value
 * @example stringifyStrictTransportSecurity({ maxAge: 63072000, includeSubDomains: true, preload: true })
 */
export function stringifyStrictTransportSecurity(
	value: SecurityHeaders.StrictTransportSecurity,
): string {
	let maxAge = Number.isFinite(value.maxAge) ? Math.max(0, Math.floor(value.maxAge)) : 0;
	let directives = [`max-age=${maxAge}`];
	if (value.includeSubDomains) directives.push("includeSubDomains");
	if (value.preload && value.includeSubDomains && maxAge >= PRELOAD_MIN_MAX_AGE) {
		directives.push("preload");
	}
	return directives.join("; ");
}

/**
 * The `X-Frame-Options` equivalent of a `frame-ancestors` list. Only `'none'` and `'self'` have
 * one; any other list leaves the header out, and browsers that read `frame-ancestors` ignore
 * `X-Frame-Options` anyway.
 *
 * @param frameAncestors - The enforced policy's `frameAncestors`
 * @returns `DENY`, `SAMEORIGIN`, or `undefined`
 */
function frameOptions(frameAncestors: CSP.SourceList | undefined): string | undefined {
	if (frameAncestors === undefined) return undefined;
	if (frameAncestors.length === 0) return "DENY";
	if (frameAncestors.length !== 1) return undefined;
	if (frameAncestors[0] === "none") return "DENY";
	if (frameAncestors[0] === "self") return "SAMEORIGIN";
	return undefined;
}

/**
 * Writes the Permissions-Policy, falling back to a stricter policy when a value has no RFC 9651
 * form: a feature name outside the key grammar names no feature and is dropped, and an
 * allowlist with an unwritable origin becomes `()`, denying the feature.
 *
 * @param policy - Feature names to allowlists
 * @returns The header value
 */
function permissionsPolicyValue(policy: PermissionsPolicy.Policy): string {
	let written = stringifyPermissionsPolicy(policy);
	if (isSuccess(written)) return written.data;

	let strict: PermissionsPolicy.Policy = {};
	for (let [feature, allowlist] of Object.entries(policy)) {
		if (!SF_KEY.test(feature)) continue;
		let writable = allowlist === "*" || allowlist.every((origin) => SF_STRING.test(origin));
		strict[feature] = writable ? allowlist : [];
	}
	let retried = stringifyPermissionsPolicy(strict);
	return isSuccess(retried) ? retried.data : "";
}

/**
 * Writes `Reporting-Endpoints`, an RFC 9651 Dictionary of URL strings, leaving out an endpoint
 * whose name or URL has no RFC 9651 form; the only effect is that reports to it are lost.
 *
 * @param endpoints - Endpoint names to URLs
 * @returns The header value
 */
function reportingEndpointsValue(endpoints: Record<string, string>): string {
	let writable: Record<string, string> = {};
	for (let [name, url] of Object.entries(endpoints)) {
		if (SF_KEY.test(name) && SF_STRING.test(url)) writable[name] = url;
	}
	let written = stringifyField(writable, "dictionary");
	return isSuccess(written) ? written.data : "";
}
