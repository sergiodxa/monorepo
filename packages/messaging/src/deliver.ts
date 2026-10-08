/**
 * The one request every send makes: a deadline joined with the caller's signal, the
 * answer read within a cap, the status mapped to a `MessagingError`, and one event on
 * the current log. Errors name the provider and host only, never the URL or a token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CheckOptions } from "@sdxc/outbound";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { currentLog } from "@sdxc/logger";
import { checkUrl, readText, resolveHost } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import type { Secret, SendOptions, Sent, SentRef } from "./destination.js";
import type { MessagingErrorCode } from "./error.js";

import { MessagingError } from "./error.js";

/** How long a send waits when the caller names no timeout. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** The most of an answer a send reads: enough for an id or an error, bounded against a hostile endpoint. */
const MAX_ANSWER_BYTES = 64 * 1024;

/** Milliseconds in a second, for `Retry-After` and `retry_after`. */
const SECOND_MS = 1000;

/** What a platform answered, read once so every classifier sees the same body. */
export interface Answer {
	status: number;
	headers: Headers;
	text: string;
	/** The body parsed as JSON, or `undefined` when it is not JSON. */
	json: unknown;
}

/** One request to one platform, and how to read what it answers. */
export interface Exchange {
	provider: string;
	/** The host the request goes to, the only part of the destination an error names. */
	host: string;
	/** Sends the request; the signal carries the deadline and the caller's cancellation. */
	request(signal: AbortSignal): Promise<Response>;
	/**
	 * Names the failure in an answer: a `4xx` the platform explains in its body, or a
	 * `2xx` whose body says it failed. `null` leaves the status to decide.
	 */
	classify?(answer: Answer): MessagingError | null;
	/** Reads where a successful send landed, or `null` when the platform answers no id. */
	ref?(answer: Answer): SentRef | null;
	/**
	 * Recognizes an error answer that still means the message reads as asked, such as an
	 * edit to the text it already has, answering what the send delivered.
	 */
	settle?(answer: Answer): Sent | null;
}

/**
 * Sends one request and answers what it means.
 *
 * @param exchange - The request and how to read its answer.
 * @param options - The caller's timeout and signal.
 * @returns The ref the platform answered, or the failure with its code and delay.
 */
export async function deliver(
	exchange: Exchange,
	options: SendOptions = {},
): Promise<Result<Sent, MessagingError>> {
	let started = Date.now();
	let result = await attempt(exchange, options);

	currentLog()?.note("messaging.send", {
		provider: exchange.provider,
		outcome: isFailure(result) ? result.error.code : "sent",
		status: isFailure(result) ? (result.error.status ?? undefined) : undefined,
		duration: Date.now() - started,
	});

	return result;
}

/** The request, the bounded read and the mapping, without the log event. */
async function attempt(
	exchange: Exchange,
	options: SendOptions,
): Promise<Result<Sent, MessagingError>> {
	let timeout = options.timeout === undefined ? DEFAULT_TIMEOUT_MS : toMs(options.timeout);
	let deadline = AbortSignal.timeout(Number.isFinite(timeout) ? timeout : DEFAULT_TIMEOUT_MS);
	let signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;

	let response: Response;
	try {
		response = await exchange.request(signal);
	} catch (error) {
		return failure(transportError(exchange, error, deadline));
	}

	let read = await readText(response, { maxBytes: MAX_ANSWER_BYTES });
	if (isFailure(read) && read.error.code === "timeout") {
		return failure(
			new MessagingError(`Timed out reading ${exchange.provider}'s answer`, {
				code: "timeout",
				provider: exchange.provider,
				host: exchange.host,
				status: response.status,
			}),
		);
	}

	let text = isFailure(read) ? "" : read.data.text;
	let answer: Answer = {
		status: response.status,
		headers: response.headers,
		text,
		json: parseJson(text),
	};

	let settled = exchange.settle?.(answer) ?? null;
	if (settled) return success(settled);

	let classified = exchange.classify?.(answer) ?? null;
	if (classified) return failure(classified);

	if (answer.status >= 200 && answer.status < 300) {
		return success({ ref: exchange.ref?.(answer) ?? null });
	}

	return failure(statusError(exchange, answer));
}

/** Parses a body as JSON, answering `undefined` for anything else. */
function parseJson(text: string): unknown {
	if (text === "") return undefined;
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

/** Maps a rejected `fetch` to `timeout` when the deadline fired, and `network` otherwise. */
function transportError(exchange: Exchange, error: unknown, deadline: AbortSignal): MessagingError {
	let timedOut =
		deadline.aborted ||
		(typeof error === "object" &&
			error !== null &&
			"name" in error &&
			error.name === "TimeoutError");
	let reason = error instanceof Error ? error.name : "error";

	return new MessagingError(
		timedOut
			? `Timed out sending to ${exchange.provider} at ${exchange.host}`
			: `Failed to reach ${exchange.provider} at ${exchange.host}: ${reason}`,
		{ code: timedOut ? "timeout" : "network", provider: exchange.provider, host: exchange.host },
	);
}

/**
 * The failure a status means when the platform's body named none: a redirect is never
 * followed, `401`/`403` is a refused credential, `429` waits the delay the platform
 * asked for, and `5xx` is the platform's own trouble.
 */
function statusError(
	exchange: Pick<Exchange, "provider" | "host">,
	answer: Answer,
): MessagingError {
	let code: MessagingErrorCode = "rejected";
	if (answer.status === 401 || answer.status === 403) code = "unauthorized";
	else if (answer.status === 429) code = "rate-limited";
	else if (answer.status >= 500) code = "unavailable";

	return answerError(exchange, answer, code, `answered ${answer.status}`);
}

/**
 * Builds the failure for an answer with the code a provider decided, carrying the
 * status and the delay the platform asked for.
 *
 * @param exchange - The provider and host the answer came from.
 * @param answer - The platform's answer.
 * @param code - What the answer means.
 * @param detail - The platform's own words for it, free of the URL and any token.
 * @example return answerError(this, answer, "gone", "no_service");
 */
export function answerError(
	exchange: Pick<Exchange, "provider" | "host">,
	answer: Answer,
	code: MessagingErrorCode,
	detail: string,
): MessagingError {
	return new MessagingError(`${exchange.provider} at ${exchange.host} ${detail}`, {
		code,
		provider: exchange.provider,
		host: exchange.host,
		status: answer.status,
		retryAfter: retryAfter(answer),
	});
}

/**
 * Reads how long the platform asked the caller to wait: the `Retry-After` header as
 * seconds or an HTTP date, then a body's `retry_after` or `parameters.retry_after`
 * in seconds, which Discord and Telegram send.
 *
 * @param answer - The platform's answer.
 * @returns Milliseconds to wait, or `null` when the platform named no delay.
 */
export function retryAfter(answer: Answer): number | null {
	let header = answer.headers.get("retry-after");
	if (header !== null) {
		let seconds = Number(header);
		if (header.trim() !== "" && Number.isFinite(seconds)) return Math.max(0, seconds * SECOND_MS);
		let date = Date.parse(header);
		if (Number.isFinite(date)) return Math.max(0, date - Date.now());
	}

	let body = record(answer.json);
	let seconds = body["retry_after"] ?? record(body["parameters"])["retry_after"];
	return typeof seconds === "number" && Number.isFinite(seconds)
		? Math.max(0, Math.ceil(seconds * SECOND_MS))
		: null;
}

/**
 * Reads a value as a string-keyed record, answering an empty one for anything else, so
 * a classifier reads optional body fields without a guard per level.
 *
 * @param value - A parsed JSON value.
 * @returns The value as a record.
 */
export function record(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

/** Which URLs a URL provider accepts. */
export interface UrlPolicy {
	/**
	 * Prefixes the URL must start with, for a platform whose webhooks live on its own
	 * host. Without them, any URL the public policy accepts.
	 */
	prefixes?: readonly string[];
	/** Also resolve the host and refuse it unless every address is public. */
	resolve?: boolean;
	/** Overrides the public policy, for a caller reaching its own network on purpose. */
	check?: CheckOptions;
}

/**
 * Checks a destination URL with the same rule a send applies, mapping a refusal to an
 * `invalid-destination` that names the host alone.
 *
 * @param provider - The provider the URL is for.
 * @param input - The URL as configured.
 * @param policy - The prefixes and policy it must pass.
 * @returns The parsed URL, or why it was refused.
 */
export function checkDestination(
	provider: string,
	input: string,
	policy: UrlPolicy = {},
): Result<URL, MessagingError> {
	let checked = checkUrl(input, policy.check);
	if (isFailure(checked)) {
		return failure(
			new MessagingError(`Refused the ${provider} destination: ${checked.error.code}`, {
				code: "invalid-destination",
				provider,
				host: hostOf(input),
			}),
		);
	}

	let url = checked.data;
	if (policy.prefixes && !policy.prefixes.some((prefix) => url.href.startsWith(prefix))) {
		return failure(
			new MessagingError(`Refused the ${provider} destination: ${url.host} is not its host`, {
				code: "invalid-destination",
				provider,
				host: url.host,
			}),
		);
	}
	return success(url);
}

/**
 * Checks a destination URL and, when the policy asks, resolves its host, so a name
 * pointing at a private address is refused before the request leaves.
 *
 * @param provider - The provider the URL is for.
 * @param input - The URL as configured.
 * @param policy - The prefixes, policy and DNS check.
 * @param signal - Cancels the lookup.
 * @returns The parsed URL, or why it was refused.
 */
export async function admitDestination(
	provider: string,
	input: string,
	policy: UrlPolicy,
	signal?: AbortSignal,
): Promise<Result<URL, MessagingError>> {
	let checked = checkDestination(provider, input, policy);
	if (isFailure(checked) || !policy.resolve) return checked;

	let resolved = await resolveHost(checked.data, signal ? { signal } : {});
	if (isFailure(resolved)) {
		return failure(
			new MessagingError(`Refused the ${provider} destination: ${resolved.error.code}`, {
				code: resolved.error.code === "network" ? "network" : "invalid-destination",
				provider,
				host: checked.data.host,
			}),
		);
	}
	return checked;
}

/** The host of a URL, or `null` when the text is not one. */
function hostOf(input: string): string | null {
	return URL.canParse(input) ? new URL(input).host : null;
}

/**
 * Fails an `update` or `reply` handed another provider's ref before any request.
 *
 * @param provider - The provider that was asked.
 * @param ref - The ref it was handed.
 * @param fields - The fields the provider needs in it.
 * @returns The failure, or `null` when the ref is this provider's and complete.
 */
export function refError(
	provider: string,
	ref: SentRef,
	fields: readonly string[],
): MessagingError | null {
	if (ref.provider !== provider) {
		return new MessagingError(`${provider} cannot use a ${ref.provider} ref`, {
			code: "invalid-ref",
			provider,
		});
	}
	let missing = fields.find((field) => typeof ref[field] !== "string" || ref[field] === "");
	if (missing === undefined) return null;
	return new MessagingError(`${provider} ref is missing ${missing}`, {
		code: "invalid-ref",
		provider,
	});
}

/**
 * Fails a message a provider cannot express before any request.
 *
 * @param provider - The provider that refused it.
 * @param why - What the message lacks.
 * @returns The failure.
 */
export function messageError(provider: string, why: string): MessagingError {
	return new MessagingError(`${provider} cannot send this message: ${why}`, {
		code: "invalid-message",
		provider,
	});
}

/**
 * Reads a credential stated directly or by a function, at send time. A reader that
 * throws is the secret store's trouble, so the send fails `unavailable` and a retry
 * asks the store again.
 *
 * @param provider - The provider the credential is for.
 * @param secret - The credential as configured.
 * @returns The credential, or why it could not be read.
 */
export async function readSecret(
	provider: string,
	secret: Secret,
): Promise<Result<string, MessagingError>> {
	if (typeof secret === "string") return success(secret);
	try {
		return success(await secret());
	} catch (error) {
		return failure(
			new MessagingError(`${provider} could not read its credential`, {
				code: "unavailable",
				provider,
				cause: error,
			}),
		);
	}
}
