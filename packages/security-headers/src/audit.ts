/**
 * Grades the security headers a response sent: each header comes back `ok`, `missing` or
 * `weak` with the reasons, read through the package's own CSP and Permissions-Policy parsers so
 * an audit and the headers the package writes agree on what each value means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";

import type { Audit, CSP } from "./lib/types.js";

import { parse as parseCSP } from "./csp.js";
import { parse as parsePermissionsPolicy } from "./permissions-policy.js";

export type { Audit } from "./lib/types.js";

/** The shortest HSTS `max-age` the audit accepts: 180 days, in seconds. */
const MIN_HSTS_MAX_AGE = 15552000;

/** Referrer-Policy tokens browsers recognize; the last recognized one in the list applies. */
const REFERRER_POLICIES: ReadonlySet<string> = new Set([
	"no-referrer",
	"no-referrer-when-downgrade",
	"origin",
	"origin-when-cross-origin",
	"same-origin",
	"strict-origin",
	"strict-origin-when-cross-origin",
	"unsafe-url",
]);

/** Referrer policies that hand the full URL, path and query included, to other origins. */
const LEAKY_REFERRER_POLICIES: ReadonlySet<string> = new Set([
	"unsafe-url",
	"no-referrer-when-downgrade",
]);

/** Cross-Origin-Opener-Policy values that isolate the browsing context group. */
const ISOLATING_COOP: ReadonlySet<string> = new Set([
	"same-origin",
	"same-origin-allow-popups",
	"noopener-allow-popups",
]);

/** Features whose `*` allowlist hands device or payment access to every embedded origin. */
const POWERFUL_FEATURES: readonly string[] = [
	"camera",
	"microphone",
	"geolocation",
	"payment",
	"usb",
];

/** Script sources that allow scripts from any host over that scheme, or from anywhere. */
const PERMISSIVE_SCRIPT_SOURCES: readonly string[] = ["*", "http:", "https:", "data:"];

/** A nonce or hash source, which makes browsers ignore `'unsafe-inline'`. */
const NONCE_OR_HASH = /^(nonce|sha256|sha384|sha512)-/;

/**
 * Grades every security header in `headers`. A Content-Security-Policy finding holds only when
 * every enforced policy shares it, since one strict policy among several is enough; HSTS is
 * graded against `url`'s scheme, because browsers apply it only over `https:`.
 *
 * @param headers - The response headers
 * @param url - The URL the response came from, after redirects
 * @returns One finding per header, in a stable order
 * @example audit(response.headers, new URL(response.url)).filter((finding) => finding.status !== "ok")
 */
export function audit(headers: Headers, url: URL): Audit.Finding[] {
	let csp = headers.get("content-security-policy");
	let parsed = csp === null ? null : parseCSP(csp);
	let policies = parsed === null || isFailure(parsed) ? [] : parsed.data;

	return [
		contentSecurityPolicy(headers, parsed),
		strictTransportSecurity(headers.get("strict-transport-security"), url),
		noSniff(headers.get("x-content-type-options")),
		frameOptions(headers.get("x-frame-options"), policies),
		referrerPolicy(headers.get("referrer-policy")),
		permissionsPolicy(headers.get("permissions-policy")),
		openerPolicy(headers.get("cross-origin-opener-policy")),
	];
}

/**
 * A finding with no notes when `notes` is empty and `weak` otherwise.
 *
 * @param header - The header name
 * @param value - The value sent
 * @param notes - The weaknesses found
 */
function graded(header: string, value: string, notes: string[]): Audit.Finding {
	return { header, status: notes.length === 0 ? "ok" : "weak", value, notes };
}

/**
 * Grades the enforced CSP. A Report-Only policy alone enforces nothing, so it leaves the
 * header `missing` with a note saying so.
 *
 * @param headers - The response headers, for the Report-Only header
 * @param parsed - The enforced header parsed, or `null` when the response sent none
 */
function contentSecurityPolicy(
	headers: Headers,
	parsed: ReturnType<typeof parseCSP> | null,
): Audit.Finding {
	let header = "content-security-policy";
	let value = headers.get(header);
	if (parsed === null || value === null) {
		let notes = headers.has("content-security-policy-report-only")
			? ["Only Content-Security-Policy-Report-Only is sent, which reports but blocks nothing"]
			: [];
		return { header, status: "missing", value: null, notes };
	}
	if (isFailure(parsed)) return graded(header, value, [parsed.error.message]);
	if (parsed.data.length === 0) return { header, status: "missing", value, notes: [] };

	let [first, ...rest] = parsed.data.map((policy) => policyWeaknesses(policy.directives));
	let shared = (first ?? []).filter((note) => rest.every((notes) => notes.includes(note)));
	return graded(header, value, shared);
}

/**
 * What one policy leaves open to script injection: script sources and plugins.
 *
 * @param directives - One parsed policy
 * @returns A note per weakness, empty when the policy holds up
 */
function policyWeaknesses(directives: CSP.Directives): string[] {
	let notes: string[] = [];
	let scripts = directives.scriptSrc ?? directives.defaultSrc;
	if (scripts === undefined) {
		notes.push("No script-src or default-src restricts where scripts load from");
	} else {
		let strictDynamic = scripts.includes("strict-dynamic");
		let nonceOrHash = strictDynamic || scripts.some((source) => NONCE_OR_HASH.test(source));
		if (scripts.includes("unsafe-inline") && !nonceOrHash) {
			notes.push("'unsafe-inline' in script-src lets any inline script run");
		}
		if (scripts.includes("unsafe-eval")) {
			notes.push("'unsafe-eval' in script-src lets strings run as code");
		}
		for (let source of PERMISSIVE_SCRIPT_SOURCES) {
			if (!strictDynamic && scripts.includes(source)) {
				notes.push(`${source} in script-src allows scripts from any host`);
			}
		}
	}
	let objects = directives.objectSrc ?? directives.defaultSrc;
	if (objects === undefined || !(objects.length === 0 || objects.includes("none"))) {
		notes.push("object-src is not 'none', so plugins can load");
	}
	return notes;
}

/**
 * Grades Strict-Transport-Security. A page served over `http:` is `weak` whatever it sends,
 * since browsers ignore the header there.
 *
 * @param value - The header value, or `null`
 * @param url - The URL the response came from
 */
function strictTransportSecurity(value: string | null, url: URL): Audit.Finding {
	let header = "strict-transport-security";
	if (url.protocol !== "https:") {
		return {
			header,
			status: "weak",
			value,
			notes: ["The page is served over http:, where browsers ignore Strict-Transport-Security"],
		};
	}
	if (value === null) return { header, status: "missing", value, notes: [] };

	let maxAge = hstsMaxAge(value);
	if (maxAge === null) return graded(header, value, ["No valid max-age directive"]);
	if (maxAge < MIN_HSTS_MAX_AGE) {
		return graded(header, value, [
			`max-age=${maxAge} is under 180 days (${MIN_HSTS_MAX_AGE} seconds)`,
		]);
	}
	return graded(header, value, []);
}

/**
 * Reads `max-age` from an HSTS value, quoted or bare, as RFC 6797 allows.
 *
 * @param value - The header value
 * @returns The seconds, or `null` when no well-formed `max-age` is present
 */
function hstsMaxAge(value: string): number | null {
	for (let directive of value.split(";")) {
		let match = /^max-age\s*=\s*"?(\d+)"?$/i.exec(directive.trim());
		if (match?.[1] !== undefined) return Number(match[1]);
	}
	return null;
}

/**
 * Grades X-Content-Type-Options, whose only meaningful value is `nosniff`.
 *
 * @param value - The header value, or `null`
 */
function noSniff(value: string | null): Audit.Finding {
	let header = "x-content-type-options";
	if (value === null) return { header, status: "missing", value, notes: [] };
	let ok = value.trim().toLowerCase() === "nosniff";
	return graded(header, value, ok ? [] : ["Only nosniff turns off MIME type sniffing"]);
}

/**
 * Grades framing protection. An enforced `frame-ancestors` supersedes X-Frame-Options in every
 * browser that reads it, so its presence makes this finding `ok` without the legacy header.
 *
 * @param value - The X-Frame-Options value, or `null`
 * @param policies - The enforced CSP policies
 */
function frameOptions(value: string | null, policies: CSP.Parsed[]): Audit.Finding {
	let header = "x-frame-options";
	if (policies.some((policy) => policy.directives.frameAncestors !== undefined)) {
		return {
			header,
			status: "ok",
			value,
			notes: ["frame-ancestors in Content-Security-Policy governs framing"],
		};
	}
	if (value === null) return { header, status: "missing", value, notes: [] };
	let option = value.trim().toUpperCase();
	let ok = option === "DENY" || option === "SAMEORIGIN";
	return graded(header, value, ok ? [] : ["Browsers honor only DENY or SAMEORIGIN"]);
}

/**
 * Grades Referrer-Policy by the token a browser applies: the last one it recognizes.
 *
 * @param value - The header value, or `null`
 */
function referrerPolicy(value: string | null): Audit.Finding {
	let header = "referrer-policy";
	if (value === null) return { header, status: "missing", value, notes: [] };
	let tokens = value.split(",").map((token) => token.trim().toLowerCase());
	let applied = tokens.filter((token) => REFERRER_POLICIES.has(token)).at(-1);
	if (applied === undefined) return graded(header, value, ["Names no policy browsers recognize"]);
	if (LEAKY_REFERRER_POLICIES.has(applied)) {
		return graded(header, value, [
			`${applied} sends the full URL, path and query included, to other origins`,
		]);
	}
	return graded(header, value, []);
}

/**
 * Grades Permissions-Policy: it must parse, and a powerful feature must not be open to every
 * embedded origin.
 *
 * @param value - The header value, or `null`
 */
function permissionsPolicy(value: string | null): Audit.Finding {
	let header = "permissions-policy";
	if (value === null) return { header, status: "missing", value, notes: [] };
	let parsed = parsePermissionsPolicy(value);
	if (isFailure(parsed)) return graded(header, value, [parsed.error.message]);
	let notes = POWERFUL_FEATURES.filter((feature) => parsed.data[feature] === "*").map(
		(feature) => `${feature}=* lets every embedded origin use it`,
	);
	return graded(header, value, notes);
}

/**
 * Grades Cross-Origin-Opener-Policy by its value, ignoring parameters such as `report-to`.
 *
 * @param value - The header value, or `null`
 */
function openerPolicy(value: string | null): Audit.Finding {
	let header = "cross-origin-opener-policy";
	if (value === null) return { header, status: "missing", value, notes: [] };
	let policy = (value.split(";")[0] ?? "").trim().toLowerCase();
	if (ISOLATING_COOP.has(policy)) return graded(header, value, []);
	return graded(header, value, [
		`${policy || value} leaves cross-origin windows a handle to this one`,
	]);
}
