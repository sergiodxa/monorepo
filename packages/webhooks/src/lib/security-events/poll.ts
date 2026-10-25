/**
 * RFC 8936 poll delivery of Security Event Tokens: the transmitter's endpoint over a
 * pluggable `SetStore`, and the recipient's client that polls, verifies the batch and
 * builds the next request's acknowledgements and errors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityEventToken } from "@sdxc/jwt";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

import type { SecurityEvents } from "../../security-events.js";

import { KeysUnavailableError, SecurityEventError, TransmissionError } from "./errors.js";
import { DESCRIPTION_LANGUAGE, readJson } from "./push.js";
import { verifySet } from "./verify.js";

/** How long a long poll waits for a SET when the options name no timeout. */
const DEFAULT_TIMEOUT = "30 seconds";

/** How often a long poll checks the store when the options name no interval. */
const DEFAULT_INTERVAL = "1 second";

/** One member of `setErrs`, as RFC 8936 §2.6 writes it. */
const ERROR_BODY = s.object({ err: s.string(), description: s.string() });

/** An RFC 8936 §2.2 poll request; every member is optional, so `{}` is a default poll. */
const POLL_REQUEST = s.object({
	ack: s.optional(s.array(s.string())),
	setErrs: s.optional(s.record(s.string(), ERROR_BODY)),
	maxEvents: s.optional(s.number().refine((n) => Number.isInteger(n) && n >= 0, "Not a count")),
	returnImmediately: s.optional(s.boolean()),
});

/** An RFC 8936 §2.3 poll response; an absent `moreAvailable` means `false`. */
const POLL_RESPONSE = s.object({
	sets: s.record(s.string(), s.string()),
	moreAvailable: s.defaulted(s.boolean(), false),
});

/**
 * Answers an RFC 8936 poll for one stream. Acknowledgements and errors are applied first,
 * then up to `maxEvents` pending SETs are returned. With nothing pending and no
 * `returnImmediately`, it long polls until a SET arrives, the timeout passes, or the
 * request is aborted. An invalid request is answered `400`, a store failure `503`.
 *
 * @param request - The recipient's POST, its body unread
 * @param options - The store, the stream the authenticated recipient owns, the long-poll timing
 * @returns The `200` JSON response carrying `sets` and, when true, `moreAvailable`
 * @example
 * router.post(routes.events, (ctx) => answerPoll(ctx.request, { store, stream: ctx.recipient.id }));
 */
export async function answerPoll(
	request: Request,
	options: SecurityEvents.AnswerPollOptions,
): Promise<Response> {
	let parsed = await validate(request, POLL_REQUEST);
	if (isFailure(parsed)) return new Response(null, { status: 400 });

	let { ack = [], setErrs = {}, maxEvents, returnImmediately = false } = parsed.data;
	let { store, stream } = options;

	if (ack.length > 0 && isFailure(await store.acknowledge(stream, ack))) return unavailable();
	if (Object.keys(setErrs).length > 0 && isFailure(await store.reject(stream, setErrs))) {
		return unavailable();
	}

	let deadline = Date.now() + toMs(options.timeout ?? DEFAULT_TIMEOUT);
	let interval = toMs(options.interval ?? DEFAULT_INTERVAL);

	for (;;) {
		let batch = await store.pending(stream, maxEvents);
		if (isFailure(batch)) return unavailable();

		let { sets, moreAvailable } = batch.data;
		let ready = Object.keys(sets).length > 0 || moreAvailable;
		if (ready || returnImmediately || Date.now() >= deadline || request.signal.aborted) {
			return Response.json(moreAvailable ? { sets, moreAvailable } : { sets });
		}

		await sleep(Math.min(interval, deadline - Date.now()), request.signal);
	}
}

/**
 * Sends one RFC 8936 poll request. A request carrying `setErrs` names the language of
 * their descriptions in `Content-Language`, as RFC 8936 §2.6 requires.
 *
 * @param endpoint - The transmitter's poll endpoint
 * @param request - Acknowledgements, errors, and how many SETs to take and whether to wait
 * @param options - Extra headers, such as `Authorization`, and an abort signal
 * @returns The batch, or why no batch was received
 * @example
 * let batch = await pollSets(endpoint, { ack, setErrs, maxEvents: 10 }, { headers: { Authorization } });
 */
export async function pollSets(
	endpoint: string | URL,
	request: SecurityEvents.PollRequest = {},
	options: SecurityEvents.PollOptions = {},
): Promise<Result<SecurityEvents.Batch, TransmissionError>> {
	let headers = new Headers(options.headers);
	headers.set("Content-Type", "application/json");
	headers.set("Accept", "application/json");
	if (request.setErrs !== undefined && Object.keys(request.setErrs).length > 0) {
		headers.set("Content-Language", DESCRIPTION_LANGUAGE);
	}

	let response: Response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(request),
			...(options.signal === undefined ? {} : { signal: options.signal }),
		});
	} catch (error) {
		return failure(new TransmissionError("The poll could not be sent", null, error));
	}

	if (response.status !== 200) {
		await response.body?.cancel();
		return failure(
			new TransmissionError(`The transmitter answered ${response.status}`, response.status),
		);
	}

	let batch = await validate(await readJson(response), POLL_RESPONSE);
	if (isFailure(batch)) {
		return failure(new TransmissionError("The poll response is malformed", 200, batch.error));
	}
	return success(batch.data);
}

/**
 * Verifies every SET of a polled batch. A verified SET joins `events` and `ack`; an
 * invalid one, or one filed under another `jti`, gets its error in `setErrs`; one whose
 * issuer keys are unavailable is in neither, so the transmitter delivers it again.
 *
 * @param sets - The batch's `sets`, by `jti`
 * @param options - Known issuers and their keys, the expected audience, the token class
 * @returns The verified SETs and the next poll's `ack` and `setErrs`
 * @example
 * let { events, ack, setErrs } = await verifyPolledSets(batch.sets, { issuers, audience });
 * await inbox.saveAll(events);
 * await pollSets(endpoint, { ack, setErrs });
 */
export async function verifyPolledSets<T extends SecurityEventToken = SecurityEventToken>(
	sets: Record<string, string>,
	options: SecurityEvents.VerifyOptions<T>,
): Promise<SecurityEvents.PolledSets<T>> {
	let polled: SecurityEvents.PolledSets<T> = { events: [], ack: [], setErrs: {} };

	for (let [id, set] of Object.entries(sets)) {
		let result = await verifySet(set, options);
		if (isFailure(result)) {
			if (result.error instanceof KeysUnavailableError) continue;
			polled.setErrs[id] = result.error.toJSON();
		} else if (result.data.id === id) {
			polled.events.push(result.data);
			polled.ack.push(id);
		} else {
			polled.setErrs[id] = new SecurityEventError(
				"invalid_request",
				`The SET's jti is not ${id}`,
			).toJSON();
		}
	}

	return polled;
}

/**
 * The answer to a poll the store could not serve, which says nothing about the request.
 *
 * @returns An empty `503`
 */
function unavailable(): Response {
	return new Response(null, { status: 503 });
}

/**
 * Waits between long-poll checks, ending early when the recipient goes away.
 *
 * @param ms - How long to wait
 * @param signal - The request's abort signal
 */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		let timer = setTimeout(done, Math.max(ms, 0));
		signal.addEventListener("abort", done, { once: true });

		/** Settles once, whichever of the timer or the abort comes first. */
		function done() {
			clearTimeout(timer);
			signal.removeEventListener("abort", done);
			resolve();
		}
	});
}
