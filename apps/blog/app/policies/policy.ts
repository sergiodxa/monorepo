/**
 * Who may do what on the blog: anyone reads a published post, and an `admin` opens the CMS,
 * reads drafts and links searches to topics. A signed-in `guest` holds nothing more than an
 * anonymous reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { allow, definePolicy } from "@sdxc/authz";

import abilities from "~/app/policies/abilities";

/** The roles are the `users.role` values, so a user's row names the role they hold. */
const policy = definePolicy(abilities, {
	everyone: [
		allow("posts.read", {
			id: "published",
			when: { op: "eq", field: "post.published", value: true },
		}),
	],
	roles: {
		guest: [],
		admin: [allow("*", { id: "admin" })],
	},
});

declare module "@sdxc/authz" {
	/** Types `ctx.access` and every check against the blog's catalog. */
	interface AuthzTypes {
		policy: typeof policy;
	}
}

export default policy;
