/**
 * Who may do what. `everyone` lists what any visitor may do, signed in or not, and `member` what
 * a signed-in visitor adds; `sdxc make policy` grants a resource's reads to everyone and its
 * writes to members. A guard under `guards` refuses whatever role is held.
 */

import { definePolicy, fact } from "@sdxc/authz";

import abilities from "~/app/policies/abilities";

/** The signed-in visitor, as a condition reads it under `actor`; absent for a guest. */
export interface Actor {
	id: string;
}

/** The app's policy, bound to each request by `app/http/middleware/access.ts`. */
const policy = definePolicy(abilities, {
	facts: { actor: fact<Actor>({ optional: true }) },
	everyone: [],
	roles: { member: [] },
});

declare module "@sdxc/authz" {
	/** Types `ctx.access` and every check against this policy's catalog and facts. */
	interface AuthzTypes {
		policy: typeof policy;
	}
}

export default policy;
