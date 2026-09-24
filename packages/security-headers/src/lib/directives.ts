/**
 * The table between the typed directive names and their wire spelling, and which grammar each
 * directive's value follows, so the serializer and the parser agree on one list of directives
 * the package models.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSP } from "./types.js";

/**
 * How a directive's value is written and read: a source list, a bare flag, a single token, a
 * list of tokens, or one of the two Trusted Types directives whose keywords are quoted.
 */
export type DirectiveKind =
	| "sources"
	| "sandbox"
	| "token"
	| "tokens"
	| "flag"
	| "trusted-types-for"
	| "trusted-types";

/** One modelled directive: its typed name, wire name and value grammar. */
export interface DirectiveSpec {
	name: keyof CSP.Directives;
	wire: string;
	kind: DirectiveKind;
}

/** Every directive the typed model carries; the parser places any other in `unknown`. */
export const DIRECTIVE_SPECS: readonly DirectiveSpec[] = [
	{ name: "defaultSrc", wire: "default-src", kind: "sources" },
	{ name: "scriptSrc", wire: "script-src", kind: "sources" },
	{ name: "scriptSrcElem", wire: "script-src-elem", kind: "sources" },
	{ name: "scriptSrcAttr", wire: "script-src-attr", kind: "sources" },
	{ name: "styleSrc", wire: "style-src", kind: "sources" },
	{ name: "styleSrcElem", wire: "style-src-elem", kind: "sources" },
	{ name: "styleSrcAttr", wire: "style-src-attr", kind: "sources" },
	{ name: "imgSrc", wire: "img-src", kind: "sources" },
	{ name: "fontSrc", wire: "font-src", kind: "sources" },
	{ name: "connectSrc", wire: "connect-src", kind: "sources" },
	{ name: "mediaSrc", wire: "media-src", kind: "sources" },
	{ name: "objectSrc", wire: "object-src", kind: "sources" },
	{ name: "frameSrc", wire: "frame-src", kind: "sources" },
	{ name: "childSrc", wire: "child-src", kind: "sources" },
	{ name: "workerSrc", wire: "worker-src", kind: "sources" },
	{ name: "manifestSrc", wire: "manifest-src", kind: "sources" },
	{ name: "baseUri", wire: "base-uri", kind: "sources" },
	{ name: "formAction", wire: "form-action", kind: "sources" },
	{ name: "frameAncestors", wire: "frame-ancestors", kind: "sources" },
	{ name: "sandbox", wire: "sandbox", kind: "sandbox" },
	{ name: "reportTo", wire: "report-to", kind: "token" },
	{ name: "reportUri", wire: "report-uri", kind: "tokens" },
	{ name: "upgradeInsecureRequests", wire: "upgrade-insecure-requests", kind: "flag" },
	{ name: "requireTrustedTypesFor", wire: "require-trusted-types-for", kind: "trusted-types-for" },
	{ name: "trustedTypes", wire: "trusted-types", kind: "trusted-types" },
];

/** Lookup by typed name, for the serializer. */
export const SPEC_BY_NAME: ReadonlyMap<string, DirectiveSpec> = new Map(
	DIRECTIVE_SPECS.map((spec) => [spec.name, spec]),
);

/** Lookup by lowercased wire name, for the parser. */
export const SPEC_BY_WIRE: ReadonlyMap<string, DirectiveSpec> = new Map(
	DIRECTIVE_SPECS.map((spec) => [spec.wire, spec]),
);

/** Source keywords CSP Level 3 writes quoted. */
export const KEYWORDS: ReadonlySet<string> = new Set<CSP.Keyword>([
	"self",
	"none",
	"unsafe-inline",
	"unsafe-eval",
	"unsafe-hashes",
	"strict-dynamic",
	"report-sample",
	"wasm-unsafe-eval",
	"inline-speculation-rules",
]);

/** Keywords of the `trusted-types` directive, quoted on the wire beside bare policy names. */
export const TRUSTED_TYPES_KEYWORDS: ReadonlySet<string> = new Set(["none", "allow-duplicates"]);
