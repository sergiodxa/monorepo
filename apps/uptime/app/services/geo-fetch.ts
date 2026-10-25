/**
 * The `GeoFetchDO` Durable Object and the probe it runs: it proxies an outbound `fetch`,
 * reports what happened in an RFC 9209 `Proxy-Status` field and its timings in `Server-Timing`.
 * The object is pinned to a location hint, so a check runs from a chosen region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SF } from "@sdxc/structured-fields";

import { isFailure } from "@sdxc/result";
import { TimingCollector } from "@sdxc/server-timing";
import { Decimal, getField, setField, Token } from "@sdxc/structured-fields";
import { DurableObject } from "cloudflare:workers";

/**
 * The name this object signs its `Proxy-Status` member with, so the reader picks its own
 * verdict out of the list even when the target sent a `Proxy-Status` of its own.
 */
export const PROBE_PROXY_NAME = "uptime-probe";

/**
 * Request header asking this object not to follow redirects, stripped before the proxied
 * request goes out so the monitored target never sees it. Exists for the public trial: a
 * stranger's URL could redirect past the pre-probe hostname check straight to cloud metadata.
 */
export const NO_REDIRECT_HEADER = "X-No-Redirect";

/** `Server-Timing` metric for the proxied `fetch`, from dispatch to response headers. */
export const PROBE_METRIC = "probe";

/**
 * `Server-Timing` metric for how long this object's handler ran — a lower bound on the
 * billed window: it excludes time before dispatch and after the response starts streaming,
 * which Cloudflare's own billing includes.
 */
export const WALL_METRIC = "wall";

/**
 * The RFC 9209 error types a failed probe is reported as. The message patterns behind each
 * are in {@link classifyProbeError}; anything unrecognised is `destination_unavailable`.
 */
export type ProbeErrorType =
	| "dns_error"
	| "dns_timeout"
	| "destination_ip_unroutable"
	| "connection_refused"
	| "connection_terminated"
	| "connection_timeout"
	| "tls_certificate_error"
	| "tls_protocol_error"
	| "http_response_timeout"
	| "http_request_error"
	| "destination_unavailable";

/** Why a probe never got a response: the registered error type and the raw message. */
export interface ProbeError {
	type: ProbeErrorType;
	/** The runtime's own message, `null` when the object reported none. */
	details: string | null;
}

/**
 * Message patterns per error type, checked in order so the more specific failure wins: a DNS
 * timeout before any DNS error, a certificate error before any TLS one. Covers workerd's
 * messages and Node's error codes, which the runtime surfaces as the message or its cause.
 */
const ERROR_PATTERNS: Array<[ProbeErrorType, RegExp]> = [
	["dns_timeout", /EAI_AGAIN|dns.*time(d)? ?out/i],
	["dns_error", /ENOTFOUND|ENODATA|getaddrinfo|\bdns\b|name not resolved|could not resolve/i],
	["connection_refused", /ECONNREFUSED|connection refused/i],
	[
		"destination_ip_unroutable",
		/EHOSTUNREACH|ENETUNREACH|no route to host|network is unreachable/i,
	],
	["http_response_timeout", /HEADERS_TIMEOUT|headers timeout|response timeout/i],
	["connection_timeout", /ETIMEDOUT|CONNECT_TIMEOUT|connect.*time(d)? ?out|connection timed out/i],
	[
		"tls_certificate_error",
		/certificate|CERT_|self[- ]signed|UNABLE_TO_VERIFY|ERR_TLS_CERT|hostname\/ip does not match/i,
	],
	["tls_protocol_error", /\btls\b|\bssl\b|handshake|EPROTO/i],
	[
		"connection_terminated",
		/ECONNRESET|EPIPE|network connection lost|socket hang up|connection reset|other side closed|connection closed/i,
	],
	["http_request_error", /fetch api cannot load|invalid url|invalid header/i],
];

/**
 * Names the RFC 9209 error type behind a failed `fetch`. The runtime reports failures only as
 * messages, so this reads the message and its `cause` chain, and calls anything it cannot
 * place `destination_unavailable`: the target was not reached, for a reason left unnamed.
 */
export function classifyProbeError(error: unknown): ProbeErrorType {
	let text = describeError(error);
	for (let [type, pattern] of ERROR_PATTERNS) if (pattern.test(text)) return type;
	return "destination_unavailable";
}

/**
 * The error's message followed by each `cause`'s message and code, which is where Node's
 * `fetch failed` keeps the reason that `ECONNREFUSED` or `ENOTFOUND` names.
 */
function describeError(error: unknown): string {
	let parts: string[] = [];
	let current: unknown = error;

	for (let depth = 0; depth < 4 && current !== undefined && current !== null; depth++) {
		if (!(current instanceof Error)) {
			if (typeof current === "string") parts.push(current);
			break;
		}
		parts.push(current.message);
		let code = (current as { code?: unknown }).code;
		if (typeof code === "string") parts.push(code);
		current = current.cause;
	}

	return parts.filter(Boolean).join(": ");
}

/**
 * Makes a message fit an sf-string, which carries printable ASCII only: any other character
 * becomes `?`, so a localized or binary-laden error still reaches the reader legibly.
 */
function toSfString(text: string): string {
	return text.replaceAll(/[^\x20-\x7e]/g, "?");
}

/**
 * Writes this object's `Proxy-Status` member, replacing any the target sent, so the field
 * holds only this object's verdict. A member without `error` means the target responded.
 */
function setProxyStatus(headers: Headers, params: SF.Parameters): void {
	setField(headers, "Proxy-Status", [{ value: new Token(PROBE_PROXY_NAME), params }], "list");
}

/**
 * Proxies one probe request and stamps its outcome and timings on the response. A failed
 * request resolves as a 204 whose `Proxy-Status` carries the error, so the caller tells a
 * down target apart from a fault in the Durable Object running this.
 *
 * @param request The probe as the HTTP check built it, `X-No-Redirect` included.
 */
export async function proxyProbe(request: Request): Promise<Response> {
	let timings = new TimingCollector();
	/**
	 * Wall time covers a failed probe too: a refused connection or a DNS failure still
	 * occupied the object, and a timing-out endpoint is the case most worth watching.
	 */
	let response = await timings.measure(WALL_METRIC, "", () => forward(request, timings));
	/** Replaces any `Server-Timing` the target sent, so each metric name is this object's. */
	timings.toHeaders(response.headers);
	return response;
}

/**
 * Sends the probe and writes this object's `Proxy-Status` on whatever comes back, timing
 * the `fetch` itself as {@link PROBE_METRIC}. Resolves for every target failure.
 */
async function forward(request: Request, timings: TimingCollector): Promise<Response> {
	/**
	 * Consumed here because it is an instruction to this object, and a monitored
	 * endpoint has no business seeing which of our callers asked for it.
	 */
	let followRedirects = request.headers.get(NO_REDIRECT_HEADER) === null;
	let probeRequest = request;
	if (!followRedirects) {
		probeRequest = new Request(request);
		probeRequest.headers.delete(NO_REDIRECT_HEADER);
	}

	try {
		/**
		 * Redirect mode `manual` returns a redirect as the 3xx response it is,
		 * letting the caller classify it as distinct from the target being unreachable.
		 */
		let response = await timings.measure(PROBE_METRIC, "", () =>
			fetch(probeRequest, { redirect: followRedirects ? "follow" : "manual" }),
		);
		response = new Response(response.body, response);
		setProxyStatus(response.headers, { "received-status": response.status });
		return response;
	} catch (error) {
		return unreachableResponse(error);
	}
}

/**
 * What a probe whose `fetch` rejected resolves as: a 204 whose `Proxy-Status` names the RFC
 * 9209 error type and carries the runtime's message as `details`, made ASCII-safe so the
 * field always serializes and the failure always reaches the reader.
 */
export function unreachableResponse(error: unknown): Response {
	let headers = new Headers();
	setProxyStatus(headers, {
		error: new Token(classifyProbeError(error)),
		details: toSfString(describeError(error)),
	});
	return new Response(null, { status: 204, headers });
}

/**
 * Reads this object's verdict off a probe response: the {@link ProbeError} when it reported
 * one, `null` when the target responded. A field that fails to parse or lacks this object's
 * member reads as responded, so only an explicit error marks a target down.
 */
export function readProbeError(headers: Headers): ProbeError | null {
	let field = getField(headers, "Proxy-Status", "list");
	if (isFailure(field) || field.data === null) return null;

	let member = field.data.find(
		(entry) => "value" in entry && String(entry.value) === PROBE_PROXY_NAME,
	);
	let type = member?.params.error;
	if (!(type instanceof Token)) return null;

	let details = member?.params.details;
	return {
		type: type.value as ProbeErrorType,
		details: typeof details === "string" ? details : null,
	};
}

/**
 * Reads one metric's `dur` off a probe response's `Server-Timing`, which this object writes
 * as valid RFC 9651 list members. `null` when the metric is missing or unparseable; a metric
 * present without `dur` measured zero, since a zero duration is written without one.
 */
export function readTiming(headers: Headers, metric: string): number | null {
	let field = getField(headers, "Server-Timing", "list");
	if (isFailure(field) || field.data === null) return null;

	let entry = field.data.find((member) => "value" in member && String(member.value) === metric);
	if (entry === undefined) return null;

	let duration = entry.params.dur;
	if (duration === undefined) return 0;
	if (typeof duration === "number" || duration instanceof Decimal) return Number(duration);
	return null;
}

/** One region-pinned probe runner; every request it receives is a probe to proxy. */
export class GeoFetchDO extends DurableObject<Cloudflare.Env> {
	/** Proxies the probe, answering a failed target with a 204 whose `Proxy-Status` names why. */
	override async fetch(request: Request): Promise<Response> {
		return await proxyProbe(request);
	}

	/**
	 * Answers the health check's RPC call. Resolving proves the class constructs and the
	 * namespace routes to it; the object keeps no storage to reach.
	 */
	ping(): void {}
}
