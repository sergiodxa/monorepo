/**
 * Registers this server's policy with `@sdxc/authz`, which types `ctx.access` in every
 * controller from the one catalog and fact set, so a check naming an ability the policy
 * lacks, or passing the wrong context, fails to compile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type policy from "~/app/authz/policy";

declare module "@sdxc/authz" {
	interface AuthzTypes {
		/** The policy `ctx.access` is bound from. */
		policy: typeof policy;
	}
}
