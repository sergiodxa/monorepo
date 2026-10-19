/**
 * Binds the request's reader as `ctx.access`: the signed-in user's `role` from their row, or no
 * role for an anonymous reader. It runs after the auth middleware, which resolves that user,
 * and loads every ability, so a handler checks with `ctx.access.can(…)` synchronously.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { access } from "@sdxc/authz/middleware/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import abilities from "~/app/policies/abilities";
import policy from "~/app/policies/policy";

/** The roles the request's user holds: their row's role once signed in, none when anonymous. */
export function rolesOf(): string[] {
	let user = getAuthUser();
	return user === null ? [] : [user.role];
}

export default access(policy, { roles: () => rolesOf(), load: [abilities] });
