/**
 * Who may do what on this server. Roles come from the subject's `role` column: every
 * subject manages their own sessions and consents, and an admin adds the admin area.
 * The one guard keeps the server's own client registration out of reach of everyone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { allow, definePolicy, deny, fact } from "@sdxc/authz";

import abilities from "~/app/authz/abilities";
import { AUTH_SERVER_CLIENT_ID } from "~/app/config";

/**
 * The policy. `actor` is the signed-in subject, always bound: the account area and the
 * admin area both sit behind the session guard, so no check here runs for a guest.
 */
export default definePolicy(abilities, {
	facts: {
		actor: fact<{ id: string }>(),
	},
	conditions: {
		ownSession: { op: "eq", field: "session.subject_id", path: "actor.id" },
		ownClient: { op: "eq", field: "client.id", value: AUTH_SERVER_CLIENT_ID },
	},
	roles: {
		user: [
			allow("account.session.revoke", {
				id: "own-session",
				when: { op: "condition", name: "ownSession" },
			}),
			allow("account.grant.revoke", { id: "own-grant" }),
		],
		admin: {
			inherits: ["user"],
			grants: [allow("admin", { id: "admin-area" })],
		},
	},
	guards: [
		deny(["admin.client.update", "admin.client.delete", "account.grant.revoke"], {
			id: "own-client",
			when: { op: "condition", name: "ownClient" },
			reason: "own-client",
		}),
	],
});
