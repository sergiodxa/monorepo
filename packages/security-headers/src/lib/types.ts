/**
 * The typed models of the response policy headers: Permissions-Policy allowlists, and the
 * non-CSP policy set the middleware applies. CSP lives in `./csp` for parse/stringify and in
 * Remix's `csp()` middleware for request nonces and response headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Content Security Policy Level 3, as a typed object written with camelCase directive names.
 */
export namespace CSP {
	/** Source keywords, written unquoted here and quoted by `stringify`. */
	export type Keyword =
		| "self"
		| "none"
		| "unsafe-inline"
		| "unsafe-eval"
		| "unsafe-hashes"
		| "strict-dynamic"
		| "report-sample"
		| "wasm-unsafe-eval"
		| "inline-speculation-rules";

	/**
	 * A source expression. Keywords and hashes are written unquoted and quoted on output;
	 * `"nonce"` is replaced by the response's nonce; anything else is a scheme (`data:`) or a
	 * host source (`https://challenges.cloudflare.com`, `*.example.com`) written as-is.
	 */
	export type Source =
		| Keyword
		| "nonce"
		| `nonce-${string}`
		| `${"sha256" | "sha384" | "sha512"}-${string}`
		| (string & {});

	/** An empty list is written as `'none'`, the source list that matches nothing. */
	export type SourceList = Source[];

	/** The directives the model carries, written in the order the object lists them. */
	export interface Directives {
		defaultSrc?: SourceList;
		scriptSrc?: SourceList;
		scriptSrcElem?: SourceList;
		scriptSrcAttr?: SourceList;
		styleSrc?: SourceList;
		styleSrcElem?: SourceList;
		styleSrcAttr?: SourceList;
		imgSrc?: SourceList;
		fontSrc?: SourceList;
		connectSrc?: SourceList;
		mediaSrc?: SourceList;
		objectSrc?: SourceList;
		frameSrc?: SourceList;
		childSrc?: SourceList;
		workerSrc?: SourceList;
		manifestSrc?: SourceList;
		baseUri?: SourceList;
		formAction?: SourceList;
		frameAncestors?: SourceList;
		/** `true` (or `[]`) sandboxes with every restriction; tokens lift the ones they name. */
		sandbox?: true | SandboxToken[];
		/** An endpoint name declared in `Reporting-Endpoints`. */
		reportTo?: string;
		/** Legacy, kept for browsers that read only this. */
		reportUri?: string[];
		upgradeInsecureRequests?: true;
		requireTrustedTypesFor?: ["script"];
		/** Policy names, plus the `none` and `allow-duplicates` keywords written unquoted. */
		trustedTypes?: string[];
	}

	/** The `sandbox` flags; an unlisted one is written as given. */
	export type SandboxToken =
		| "allow-forms"
		| "allow-modals"
		| "allow-popups"
		| "allow-same-origin"
		| "allow-scripts"
		| "allow-downloads"
		| (string & {});

	/** What `stringify` needs beyond the directives. */
	export interface StringifyOptions {
		/** Substituted for every `"nonce"` source; without it those sources are dropped. */
		nonce?: string;
	}

	/** A directive whose value is `null` in an override is removed from the result. */
	export type Override = { [Name in keyof Directives]?: Directives[Name] | null };

	/** One policy read from a header value. */
	export interface Parsed {
		directives: Directives;
		/** Directives the policy repeated or this package does not model, kept verbatim. */
		unknown: Record<string, string[]>;
	}
}

/**
 * The Permissions-Policy header as a map from feature name to the origins allowed to use it.
 */
export namespace PermissionsPolicy {
	/** `[]` denies the feature, `"*"` allows every origin, a list allows those named. */
	export type Allowlist = [] | "*" | Array<"self" | "src" | (string & {})>;
	/** Feature names as the header spells them, since they are registry identifiers. */
	export type Policy = Record<string, Allowlist>;
}

/**
 * The non-CSP response policy header set an app configures once and the middleware applies.
 * Content-Security-Policy and Reporting-Endpoints come from Remix's `csp()` middleware.
 */
export namespace SecurityHeaders {
	/** RFC 6797 Strict-Transport-Security. */
	export interface StrictTransportSecurity {
		/** Seconds the browser keeps reaching the host over HTTPS only. */
		maxAge: number;
		includeSubDomains?: boolean;
		/** Written only with a `maxAge` of a year or more and `includeSubDomains`, as preload lists require. */
		preload?: boolean;
	}

	/** Referrer Policy tokens. */
	export type ReferrerPolicy =
		| "no-referrer"
		| "no-referrer-when-downgrade"
		| "origin"
		| "origin-when-cross-origin"
		| "same-origin"
		| "strict-origin"
		| "strict-origin-when-cross-origin"
		| "unsafe-url";

	/** Every non-CSP header the package writes, each left out when its field is absent. */
	export interface Policy {
		/** Written only on `https:` requests, since browsers ignore it over plain HTTP. */
		strictTransportSecurity?: StrictTransportSecurity;
		/** Several values are a fallback list, the last one the browser understands wins. */
		referrerPolicy?: ReferrerPolicy | ReferrerPolicy[];
		permissionsPolicy?: PermissionsPolicy.Policy;
		crossOriginOpenerPolicy?:
			| "same-origin"
			| "same-origin-allow-popups"
			| "noopener-allow-popups"
			| "unsafe-none";
		crossOriginEmbedderPolicy?: "require-corp" | "credentialless" | "unsafe-none";
		/** Sent alongside or instead, to observe cross-origin isolation before enforcing it. */
		crossOriginEmbedderPolicyReportOnly?: "require-corp" | "credentialless" | "unsafe-none";
		crossOriginResourcePolicy?: "same-origin" | "same-site" | "cross-origin";
		/**
		 * Legacy framing control for browsers that ignore `frame-ancestors`. Prefer CSP
		 * `frameAncestors` via Remix `csp()` for modern clients.
		 */
		xFrameOptions?: "DENY" | "SAMEORIGIN";
		/** @default true */
		noSniff?: boolean;
	}

	/** A policy patch: a header set to `null` is not sent for that response. */
	export type Override = {
		[Name in keyof Policy]?: Policy[Name] | null;
	};

	/** The per-response facts the headers depend on. */
	export interface ApplyOptions {
		/** HSTS is written only for `https:`. */
		url: URL;
	}
}

/**
 * The verdict `audit` reaches for each security header a response sends or leaves out.
 */
export namespace Audit {
	/** `missing` and `weak` are the problems; `ok` holds up against the checks the audit runs. */
	export type Status = "ok" | "missing" | "weak";

	/** One header's verdict, with the reasons behind a `weak` (and context for an `ok`). */
	export interface Finding {
		/** The lowercase header name. */
		header: string;
		status: Status;
		/** The value the response sent, `null` when it sent none. */
		value: string | null;
		notes: string[];
	}
}
