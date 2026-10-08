/**
 * Discovery of ActivityPub actors through WebFinger: the `self` link that points a
 * handle such as `acct:user@host` at the actor document, which Mastodon follows to
 * resolve an account, and `lookup`, which resolves a remote handle the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { JrdLink } from "@sdxc/well-known/webfinger";

import { failure, isFailure, success } from "@sdxc/result";
import { MEDIA_TYPE, parse } from "@sdxc/well-known/webfinger";

import type { ActivityPub } from "./lib/types.js";
import type { Resolver } from "./remote.js";

import { ActivityPubFetchError } from "./errors.js";
import { ACTIVITY_JSON, AS2_CONTEXT, LD_JSON } from "./lib/constants.js";
import { DEFAULT_TIMEOUT, fetchText } from "./lib/fetch.js";

/** A JRD names a handful of links; anything near this size is not a WebFinger answer. */
const MAX_JRD_BYTES = 64 * 1024;

/** `acct:user@host`, `user@host` or `@user@host`; the host may carry a port. */
const HANDLE_PATTERN = /^(?:acct:|@)?([^@\s/]+)@([^@\s/?#]+)$/u;

/** What `lookup` resolves the actor through. */
export interface LookupOptions {
	/** Fetches the actor the WebFinger `self` link names. */
	resolver: Resolver;
	/** Sent with the WebFinger request; some instances refuse requests without one. */
	userAgent?: string;
	/** @default "10 seconds" */
	timeout?: DurationInput;
}

/**
 * The WebFinger link to an actor document: `rel="self"` typed
 * `application/activity+json`, which Mastodon requires before it fetches the actor. WebFinger
 * for `preferredUsername@<actor host>` must answer this link for the reverse check.
 *
 * @param actorId - The actor document's id.
 * @example
 * let jrd = { subject: "acct:hello@example.com", aliases: [], properties: {}, links: [actorLink(ACTOR_ID)] };
 */
export function actorLink(actorId: string): JrdLink {
	return { rel: "self", type: ACTIVITY_JSON, href: actorId, titles: {}, properties: {} };
}

/**
 * Resolves a handle to its actor the way Mastodon does: WebFinger on the handle's host, the
 * `self` link typed as ActivityStreams, then the actor through `resolver`. The actor's
 * canonical handle is `preferredUsername@<actor host>`; unless it equals the given handle,
 * WebFinger on the actor's host must point that canonical handle back at the same actor.
 *
 * @param handle - `@user@host`, `user@host` or `acct:user@host`.
 * @param options - The resolver, and the `User-Agent` and deadline of the WebFinger requests.
 * @returns The actor; `not-found` when WebFinger names no actor link, `id-mismatch` when the
 * actor's host does not confirm the handle, `refused-url` for a handle that names no host.
 * @example let actor = await lookup("@someone@mastodon.social", { resolver });
 */
export async function lookup(
	handle: string,
	options: LookupOptions,
): Promise<Result<ActivityPub.Actor, ActivityPubFetchError>> {
	let match = HANDLE_PATTERN.exec(handle.trim());
	let user = match?.[1];
	let host = match?.[2];
	if (user === undefined || host === undefined || !URL.canParse(`https://${host}/`)) {
		return failure(
			new ActivityPubFetchError("refused-url", handle, `${handle} is not a user@host handle`),
		);
	}

	let self = await selfLink(user, host, options);
	if (isFailure(self)) return self;

	let actor = await options.resolver.actor(self.data);
	if (isFailure(actor)) return actor;

	let actorId = actor.data.id;
	let actorHost = new URL(actorId).host;
	let username = actor.data.preferredUsername;
	let sameHost = actorHost === new URL(`https://${host}/`).host;
	if (sameHost && username.toLowerCase() === user.toLowerCase()) return actor;

	let canonical = `${username}@${actorHost}`;
	let reverse = await selfLink(username, actorHost, options);
	if (isFailure(reverse) && reverse.error.retryable) return reverse;
	if (isFailure(reverse) || reverse.data !== actorId) {
		return failure(
			new ActivityPubFetchError(
				"id-mismatch",
				actorId,
				`${actorId} is ${canonical}, whose WebFinger does not confirm ${user}@${host}`,
				{ cause: isFailure(reverse) ? reverse.error : undefined },
			),
		);
	}
	return actor;
}

/**
 * The `self` link typed as ActivityStreams that WebFinger on `host` answers for
 * `acct:user@host`; `not-found` when it names none.
 */
async function selfLink(
	user: string,
	host: string,
	options: LookupOptions,
): Promise<Result<string, ActivityPubFetchError>> {
	let account = `acct:${user}@${host}`;
	let url = new URL(`https://${host}/.well-known/webfinger`);
	url.searchParams.set("resource", account);

	let headers = new Headers({ accept: MEDIA_TYPE });
	if (options.userAgent !== undefined) headers.set("user-agent", options.userAgent);

	let body = await fetchText(url.href, {
		headers,
		timeout: options.timeout ?? DEFAULT_TIMEOUT,
		maxBytes: MAX_JRD_BYTES,
	});
	if (isFailure(body)) return body;

	let jrd = parse(body.data.text);
	if (isFailure(jrd)) {
		return failure(
			new ActivityPubFetchError("invalid-document", url.href, jrd.error.message, {
				cause: jrd.error,
			}),
		);
	}

	let self = jrd.data.links.find((link) => link.rel === "self" && isActivityType(link.type));
	if (self === undefined || self.href === null) {
		return failure(
			new ActivityPubFetchError("not-found", url.href, `${account} names no ActivityPub actor`),
		);
	}
	return success(self.href);
}

/**
 * Whether a link's media type is ActivityStreams: `application/activity+json`, or
 * `application/ld+json` with the AS2 profile, which some servers write instead.
 */
function isActivityType(type: string | null | undefined): boolean {
	if (type === null || type === undefined) return false;
	let [essence = "", ...parameters] = type.split(";").map((part) => part.trim());
	if (essence.toLowerCase() === ACTIVITY_JSON) return true;
	if (essence.toLowerCase() !== LD_JSON) return false;
	return parameters.some((parameter) => parameter.replaceAll('"', "") === `profile=${AS2_CONTEXT}`);
}
