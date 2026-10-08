/**
 * Everything a signed-in subject may do on this server, declared once with the context
 * each check passes. Controllers, views and the policy test import the same catalog,
 * so a page hides exactly what its action would refuse.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { abilities, ability, context } from "@sdxc/authz";

/**
 * The slice of a client row a client ability reads, so a check needs no database read:
 * its id alone tells the provider's own registration apart.
 */
export interface ClientTarget {
	id: string;
}

/** The slice of a session row a revocation reads: whose refresh token it is. */
export interface SessionTarget {
	id: string;
	subject_id: string;
}

/**
 * The catalog. `admin.access` is a claim gating the whole admin area; the record
 * abilities name the client or session they act on, which the policy's conditions read.
 */
export default abilities({
	admin: {
		access: ability({
			description: "Open the admin area: its dashboard, client and subject pages",
		}),
		client: {
			update: ability({
				context: context<{ client: ClientTarget }>("client"),
				description: "Edit a client's registration or rotate its secret",
			}),
			delete: ability({
				context: context<{ client: ClientTarget }>("client"),
				description: "Delete a client and every consent given to it",
			}),
		},
	},
	account: {
		session: {
			revoke: ability({
				context: context<{ session: SessionTarget }>("session"),
				deniedAs: "notFound",
				description: "Sign one of the subject's own devices out",
			}),
		},
		grant: {
			revoke: ability({
				context: context<{ client: ClientTarget }>("client"),
				description: "Withdraw the subject's consent for a client",
			}),
		},
	},
});
