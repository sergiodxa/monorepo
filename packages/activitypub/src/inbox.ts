/**
 * An ActivityPub inbox in two halves: `receive` verifies a POST inside the request, so a
 * sender learns from the status whether to retry or fall back, and `handle` processes the
 * verified activity in a job, doing the protocol's work before the app's handler runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { InboxError, PUBLIC_MESSAGE } from "./lib/inbox-error.js";

export type { InboxErrorCode } from "./lib/inbox-error.js";
export type {
	DeleteInbound,
	FollowDecision,
	HandleOptions,
	HandleOutcome,
	HandleReason,
	Handlers,
	Inbound,
} from "./lib/inbox-handle.js";
export type {
	BlockedCheck,
	ReceiveOptions,
	Received,
	Verification,
	VerifiedFetch,
	VerifyFetchOptions,
} from "./lib/inbox-receive.js";
export type { Summary, SummaryAuthor } from "./lib/inbox-summarize.js";

export { InboxError } from "./lib/inbox-error.js";
export { handle } from "./lib/inbox-handle.js";
export {
	DEFAULT_INBOX_MAX_AGE,
	DEFAULT_INBOX_MAX_BYTES,
	INBOX_INPUT,
	receive,
	verifyFetch,
} from "./lib/inbox-receive.js";
export { summarize } from "./lib/inbox-summarize.js";

/**
 * The answer to an activity `receive` verified and the app enqueued: `202`, since it is
 * processed later and a sender only needs to know it arrived.
 *
 * @example return accepted();
 */
export function accepted(): Response {
	return new Response(null, { status: 202 });
}

/**
 * The answer to a request `receive` or `verifyFetch` refused, with the error's status and a
 * fixed text per code, so a sender sees which rule failed and never how the verifier
 * failed. `ignored` answers an empty `202`.
 *
 * @param error - The refusal.
 * @example if (isFailure(received)) return rejected(received.error);
 */
export function rejected(error: InboxError): Response {
	let text = PUBLIC_MESSAGE[error.code];
	if (text === "") return new Response(null, { status: error.status });
	return new Response(text, {
		status: error.status,
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}
