/**
 * `POST /tenants/:tenantId/members/invite`: invites an address to administer the
 * tenant's dashboard, for a person with no platform dashboard account yet — the
 * email flow `members.ts`'s own direct-grant route cannot offer, since that route
 * requires an already-known `subjectId`. Mints a single-use, hashed, time-boxed
 * token the same way every other ticket in this codebase does, supersedes any
 * invitation already outstanding for the same tenant and address, and emails the
 * token as an accept link — never echoing the plaintext token back through the
 * response itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex, randomToken, sha256 } from "@sdxc/crypto";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { mountedMiddleware } from "~/app/http/controllers/management/tenants/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { mailTranslator } from "~/app/mail/locale";
import { TenantInvitationEmail } from "~/app/mail/tenant-invitation-email";
import Tenant from "~/app/models/tenant";
import TenantMemberInvitation from "~/app/models/tenant-member-invitation";
import { foldIdentifier } from "~/database/subject-identifiers";
import routes from "~/routes/management";

/** How long a minted invitation stands before it can no longer be accepted. */
const TENANT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let InviteMemberBodySchema = s.object({
	email: s.string(),
	role: s.enum_(["owner", "admin", "member"] as const),
});

/** Refuses a body whose email does not fold, since `remix/data-schema` alone cannot express that rule. */
function invalidEmail(): Response {
	return problem({
		type: "https://docs.example.com/errors/validation-failed",
		title: "The request body did not pass validation",
		status: 400,
		errors: [{ pointer: "/email", code: "invalid", message: "Not a valid email address." }],
	});
}

/**
 * Builds the `tenantMembersInvite` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantMembersInvite, createTenantMembersInviteAction(options));
 */
export function createTenantMembersInviteAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantMembersInvite, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let parsed = parseBody(InviteMemberBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let folded = foldIdentifier("email", parsed.data.email);
			if (!folded.ok) return invalidEmail();

			let tenantId = ctx.managementCaller.tenantId;
			let tenant = await Tenant.findById(ctx.db, tenantId);
			if (!tenant) throw new Error("management caller resolved to a tenant that no longer exists");

			let token = randomToken({ bytes: 32 });
			let hashed = await sha256(token);
			if (isFailure(hashed)) throw new Error("failed to hash the tenant invitation token");
			let tokenHash = Hex.encode(hashed.data);

			// Supersedes rather than piling up: a second invitation to the same
			// address replaces any invitation still outstanding, the same
			// delete-before-insert idiom `magic_link_attempts` already follows for
			// its own outstanding attempt.
			await TenantMemberInvitation.deletePendingByTenantAndEmail(ctx.db, tenantId, folded.folded);

			let expiresAt = Date.now() + TENANT_INVITATION_TTL_MS;

			let invitation = await TenantMemberInvitation.create(ctx.db, {
				tenantId,
				email: folded.folded,
				role: parsed.data.role,
				tokenHash,
				invitedBy: ctx.managementCaller.actor.id,
				expiresAt,
			});

			let { t } = await mailTranslator();
			let url = `https://dashboard.${env.PLATFORM_DOMAIN}/invitations/accept?token=${token}`;

			await ctx.mail.send(
				new TenantInvitationEmail({
					email: parsed.data.email,
					tenantName: tenant.name,
					role: parsed.data.role,
					url,
					t,
				}),
			);

			return json({ id: invitation.id, expiresAt: invitation.expires_at }, { status: 201 });
		},
	});
}
