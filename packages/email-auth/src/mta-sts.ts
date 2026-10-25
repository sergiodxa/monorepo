/**
 * Reads SMTP MTA Strict Transport Security (RFC 8461): the `_mta-sts` TXT record that
 * announces a policy and its id, the policy file served at
 * `https://mta-sts.<domain>/.well-known/mta-sts.txt`, and the MX patterns it allows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DoHError } from "@sdxc/doh";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import type { LookupOptions } from "./lookup.js";

import { RecordParseError } from "./errors.js";
import { lookupTxt, normalizeDomain } from "./lookup.js";
import { splitTags } from "./tag-list.js";

/** RFC 8461 §3.1's `sts-id`. */
const POLICY_ID = /^[A-Za-z0-9]{1,32}$/;

/** RFC 8461 §3.1's `sts-ext-name`, which §3.2's `sts-policy-ext-name` repeats. */
const FIELD_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/;

/** The largest `max_age` the policy grammar allows: one year, in seconds. */
const MAX_AGE_LIMIT = 31_557_600;

/** RFC 8461 §3.3's suggested cap on a policy body. */
const MAX_POLICY_BYTES = 64 * 1024;

/** An `mx` pattern: a domain, optionally behind one `*.` wildcard label. */
const MX_PATTERN =
	/^(?:\*\.)?(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9-]{2,63}\.?$/;

/** Groups the MTA-STS types under one import surface. */
export namespace MTASTS {
	/** The `_mta-sts` TXT record. */
	export interface Record {
		/** Changes whenever the policy file does, so senders know to fetch it again. */
		id: string;
		/** Every field as written, extensions included. */
		fields: { [name: string]: string };
	}

	/** How senders treat an MX that fails validation: refuse, report only, or ignore. */
	export type Mode = "enforce" | "testing" | "none";

	/** The policy file. */
	export interface Policy {
		mode: Mode;
		/** MX host patterns, such as `mail.example.com` or `*.example.net`. */
		mx: string[];
		/** Seconds a sender may cache the policy. */
		maxAge: number;
		/** Every field as written, `mx` joined by newlines, extensions included. */
		fields: { [name: string]: string };
	}

	/** What TXT discovery found at `_mta-sts.<domain>`. */
	export type Discovery =
		| { status: "none"; name: string }
		| { status: "multiple"; name: string; count: number }
		| { status: "invalid"; name: string; error: RecordParseError }
		| { status: "found"; name: string; record: Record };

	/** Options for fetching the policy file. */
	export interface FetchOptions {
		/**
		 * How long the request and its body may take.
		 *
		 * @default "1 minute"
		 */
		timeout?: DurationInput;
		signal?: AbortSignal;
	}
}

/** Which step of fetching a policy file failed. */
export type PolicyFetchFailure = "request" | "status" | "content-type" | "invalid";

/**
 * A policy file that could not be read, which senders treat as no policy unless they
 * cached one. `cause` holds the `OutboundError` or `RecordParseError` behind it.
 */
export class PolicyFetchError extends Error {
	override name = "PolicyFetchError";

	/** `request` for a refused, failed or oversized fetch; the rest name the check that failed. */
	readonly reason: PolicyFetchFailure;

	/** The HTTP status, when a response arrived. */
	readonly status: number | null;

	/**
	 * @param reason - The step that failed.
	 * @param message - What went wrong.
	 * @param status - The HTTP status, when a response arrived.
	 * @param options - The underlying error.
	 */
	constructor(
		reason: PolicyFetchFailure,
		message: string,
		status: number | null,
		options?: ErrorOptions,
	) {
		super(message, options);
		this.reason = reason;
		this.status = status;
	}
}

/** Whether a TXT record announces itself as MTA-STS. */
export function isMtaStsRecord(text: string): boolean {
	return /^v=STSv1\s*(?:;|$)/.test(text);
}

/**
 * Parses the `_mta-sts` TXT record: `v=STSv1` first and an `id` of 1 to 32 letters and
 * digits. Unknown fields are kept and otherwise ignored, and a repeated field keeps its first value.
 *
 * @param text - The TXT record, its character-strings concatenated.
 * @returns The record, or why senders would ignore it.
 * @example parseMtaStsRecord("v=STSv1; id=20160831085700Z;")
 */
export function parseMtaStsRecord(text: string): Result<MTASTS.Record, RecordParseError> {
	if (!isMtaStsRecord(text)) return invalid("mta-sts", "The record does not start with `v=STSv1`");

	let tags = splitTags(text);
	if (tags === null) return invalid("mta-sts", "A field is missing its `=`");

	let fields: { [name: string]: string } = {};
	for (let tag of tags.slice(1)) {
		if (!FIELD_NAME.test(tag.name))
			return invalid("mta-sts", `\`${tag.name}\` is not a field name`);
		if (!Object.hasOwn(fields, tag.name)) fields[tag.name] = tag.value;
	}

	let id = fields["id"];
	if (id === undefined) return invalid("mta-sts", "The record has no `id` field");
	if (!POLICY_ID.test(id)) return invalid("mta-sts", "`id` must be 1 to 32 letters and digits");

	return success({ id, fields: { v: "STSv1", ...fields } });
}

/**
 * Parses an MTA-STS policy file. `version: STSv1`, `mode` and `max_age` are required, and
 * at least one `mx` unless the mode is `none`. Lines end in LF or CRLF; a repeated field
 * other than `mx` keeps its first value, and unknown fields are ignored.
 *
 * @param text - The body served at `/.well-known/mta-sts.txt`.
 * @returns The policy, or why senders would ignore it.
 * @example parseMtaStsPolicy("version: STSv1\nmode: enforce\nmx: mail.example.com\nmax_age: 604800\n")
 */
export function parseMtaStsPolicy(text: string): Result<MTASTS.Policy, RecordParseError> {
	let fields: { [name: string]: string } = {};
	let mx: string[] = [];

	for (let line of text.split(/\r?\n/)) {
		if (line.trim() === "") continue;
		let match = /^([A-Za-z0-9][A-Za-z0-9_.-]{0,31}):[ \t]*(.*?)[ \t]*$/.exec(line);
		if (!match) return invalid("mta-sts-policy", `\`${line}\` is not a \`key: value\` line`);
		let [, key = "", value = ""] = match;
		if (key === "mx") {
			if (!MX_PATTERN.test(value)) {
				return invalid("mta-sts-policy", `\`${value}\` is not an MX pattern`);
			}
			mx.push(normalizeDomain(value));
		} else if (!Object.hasOwn(fields, key)) {
			fields[key] = value;
		}
	}

	if (fields["version"] !== "STSv1") {
		return invalid("mta-sts-policy", "The policy has no `version: STSv1`");
	}

	let mode = fields["mode"];
	if (mode !== "enforce" && mode !== "testing" && mode !== "none") {
		return invalid("mta-sts-policy", "`mode` must be `enforce`, `testing` or `none`");
	}

	let maxAge = fields["max_age"];
	if (maxAge === undefined || !/^\d{1,10}$/.test(maxAge) || Number(maxAge) > MAX_AGE_LIMIT) {
		return invalid("mta-sts-policy", `\`max_age\` must be whole seconds up to ${MAX_AGE_LIMIT}`);
	}

	if (mx.length === 0 && mode !== "none") {
		return invalid("mta-sts-policy", "A policy that is not `mode: none` needs an `mx`");
	}

	return success({ mode, mx, maxAge: Number(maxAge), fields: { ...fields, mx: mx.join("\n") } });
}

/**
 * Whether an MX host is allowed by a policy pattern. A `*.` pattern matches exactly one
 * label in its place, so `*.example.com` matches `mail.example.com` and neither
 * `example.com` nor `a.b.example.com`. Names compare case-insensitively.
 *
 * @param host - The MX host name.
 * @param patterns - The policy's `mx` patterns.
 * @example matchesMxPattern("mail.example.net", ["*.example.net"]) // true
 */
export function matchesMxPattern(host: string, patterns: readonly string[]): boolean {
	let name = normalizeDomain(host);
	return patterns.some((pattern) => {
		let normalized = normalizeDomain(pattern);
		if (!normalized.startsWith("*.")) return name === normalized;
		let dot = name.indexOf(".");
		return dot > 0 && name.slice(dot + 1) === normalized.slice(2);
	});
}

/**
 * Looks up the `_mta-sts` TXT record, applying RFC 8461's selection: records that are not
 * `v=STSv1` are discarded, and anything but exactly one remaining record means the domain
 * has no policy. A CNAME at the name is followed by the resolver.
 *
 * @param domain - The policy domain.
 * @param options - Resolver, signal and timeout.
 * @returns What discovery found, or the DNS failure that left it unknown.
 * @example await discoverMtaSts("example.com")
 */
export async function discoverMtaSts(
	domain: string,
	options: LookupOptions = {},
): Promise<Result<MTASTS.Discovery, DoHError>> {
	let name = `_mta-sts.${normalizeDomain(domain)}`;
	let texts = await lookupTxt(name, options);
	if (isFailure(texts)) return texts;

	let candidates = texts.data.filter(isMtaStsRecord);
	let [text] = candidates;
	if (text === undefined) return success({ status: "none", name });
	if (candidates.length > 1) return success({ status: "multiple", name, count: candidates.length });

	let record = parseMtaStsRecord(text);
	if (isFailure(record)) return success({ status: "invalid", name, error: record.error });
	return success({ status: "found", name, record: record.data });
}

/**
 * The URL a domain's policy file is served from.
 *
 * @example mtaStsPolicyUrl("example.com") // "https://mta-sts.example.com/.well-known/mta-sts.txt"
 */
export function mtaStsPolicyUrl(domain: string): string {
	return `https://mta-sts.${normalizeDomain(domain)}/.well-known/mta-sts.txt`;
}

/**
 * Fetches and parses a domain's policy file the way a sending MTA does: HTTPS only, no
 * redirects, a 200 with a `text/plain` body of at most 64 KiB, under one deadline. Every
 * hop is checked by `@sdxc/outbound`, so a name pointing at a private address is refused.
 *
 * @param domain - The policy domain.
 * @param options - Deadline and abort signal.
 * @returns The policy, or which step failed.
 * @example await fetchMtaStsPolicy("example.com", { timeout: "10 seconds" })
 */
export async function fetchMtaStsPolicy(
	domain: string,
	options: MTASTS.FetchOptions = {},
): Promise<Result<MTASTS.Policy, PolicyFetchError>> {
	let followed = await follow(mtaStsPolicyUrl(domain), {
		ports: "default",
		maxRedirects: 0,
		timeout: options.timeout ?? "1 minute",
		headers: { accept: "text/plain" },
		...(options.signal ? { signal: options.signal } : {}),
	});
	if (isFailure(followed))
		return fetchFailed("request", followed.error.message, null, followed.error);

	let { response } = followed.data;
	if (response.status !== 200) {
		release(response.body);
		return fetchFailed(
			"status",
			`The policy host answered HTTP ${response.status}`,
			response.status,
		);
	}

	let contentType = response.headers.get("content-type");
	if (contentType === null || !/^text\/plain\s*(?:;|$)/i.test(contentType)) {
		release(response.body);
		return fetchFailed(
			"content-type",
			`The policy is served as ${contentType ?? "no media type"}, not text/plain`,
			200,
		);
	}

	let body = await readText(response, { maxBytes: MAX_POLICY_BYTES });
	if (isFailure(body)) return fetchFailed("request", body.error.message, 200, body.error);

	let policy = parseMtaStsPolicy(body.data.text);
	if (isFailure(policy)) return fetchFailed("invalid", policy.error.message, 200, policy.error);
	return success(policy.data);
}

/** The failure for one step of fetching a policy file. */
function fetchFailed(
	reason: PolicyFetchFailure,
	message: string,
	status: number | null,
	cause?: Error,
): Result<never, PolicyFetchError> {
	return failure(new PolicyFetchError(reason, message, status, cause ? { cause } : undefined));
}

/** The failure for a record or policy file senders ignore. */
function invalid(
	protocol: "mta-sts" | "mta-sts-policy",
	message: string,
): Result<never, RecordParseError> {
	return failure(new RecordParseError(protocol, message));
}
