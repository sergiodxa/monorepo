/**
 * Binds the request's principal as `ctx.access`. A visitor whose session holds an `actor` is a
 * `member` and anyone else a guest, so signing someone in is `ctx.session.set("actor", { id })`.
 * Every ability loads up front, so a handler checks with `ctx.access.can(…)` synchronously.
 */

import { access } from "@sdxc/authz/middleware/router";
import * as s from "remix/data-schema";
import { Session } from "remix/session";

import type { Actor } from "~/app/policies/policy";

import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";

/** The session key a sign-in stores the visitor under, and `signedIn` reads back. */
export const ACTOR_KEY = "actor";

/** The shape a signed-in visitor is stored in; any other value reads as a guest. */
const STORED_ACTOR = s.object({ id: s.string() });

/**
 * The signed-in visitor the session holds, or `undefined` for a guest. A request without a
 * session, or one whose stored value has no string `id`, reads as a guest.
 */
export function signedIn(session: Session | undefined): Actor | undefined {
	let stored = s.parseSafe(STORED_ACTOR, session?.get(ACTOR_KEY));
	return stored.success ? { id: stored.value.id } : undefined;
}

/** The roles the session's visitor holds: `member` once signed in, none for a guest. */
export function rolesOf(session: Session | undefined): string[] {
	return signedIn(session) === undefined ? [] : ["member"];
}

/**
 * The page chain's binding, after the session middleware, with the visitor as the `actor` fact
 * conditions read.
 */
export default access(policy, {
	roles: (ctx) => rolesOf(ctx.get(Session)),
	facts: { actor: (ctx) => signedIn(ctx.get(Session)) },
	load: [abilities],
});
