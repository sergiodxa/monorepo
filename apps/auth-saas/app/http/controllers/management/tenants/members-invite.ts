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
import { isFailure, unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { mountedMiddleware } from "~/app/http/controllers/management/tenants/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { TENANT_MEMBERS_INVITE } from "~/app/http/openapi/tenants";
import { mailTranslator } from "~/app/mail/locale";
import { TenantInvitationEmail } from "~/app/mail/tenant-invitation-email";
import { foldIdentifier } from "~/database/subject-identifiers";
import routes from "~/routes/management";

/** How long a minted invitation stands before it can no longer be accepted. */
const TENANT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Refuses a body whose email does not fold, a rule the body schema alone cannot express. */
function invalidEmail(): Response {
	return managementProblem("validationFailed", {
		detail: "The request body did not pass validation.",
		extensions: {
			errors: [{ pointer: "/email", code: "invalid", message: "Not a valid email address." }],
		},
	});
}

/**
 * Builds the `tenantMembersInvite` action. A second invitation to the same address
 * replaces any invitation still outstanding, so one address holds one live token.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantMembersInvite, createTenantMembersInviteAction(options));
 */
export function createTenantMembersInviteAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantMembersInvite, {
		middleware: [
			...mountedMiddleware(options, "write"),
			managementTenant(options.resolveStub),
			managementIdempotency,
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let input = await TENANT_MEMBERS_INVITE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);
			let body = input.data.body;

			let folded = foldIdentifier("email", body.email);
			if (!folded.ok) return invalidEmail();

			let tenantId = ctx.managementCaller.tenantId;
			let tenant = await ctx.models.tenants.find(tenantId);
			if (!tenant) throw new Error("management caller resolved to a tenant that no longer exists");

			let token = randomToken({ bytes: 32 });
			let hashed = await sha256(token);
			if (isFailure(hashed)) throw new Error("failed to hash the tenant invitation token");
			let tokenHash = Hex.encode(hashed.data);

			await ctx.models.tenantMemberInvitations.pendingFor(tenantId, folded.folded).delete();

			let expiresAt = Date.now() + TENANT_INVITATION_TTL_MS;

			let invitation = unwrap(
				await ctx.models.tenantMemberInvitations.create({
					tenant_id: tenantId,
					email: folded.folded,
					role: body.role,
					token_hash: tokenHash,
					invited_by: ctx.managementCaller.actor.id,
					expires_at: expiresAt,
				}),
			);

			let { t } = mailTranslator();
			let url = `https://dashboard.${env.PLATFORM_DOMAIN}/invitations/accept?token=${token}`;

			await ctx.mail.send(
				new TenantInvitationEmail({
					email: body.email,
					tenantName: tenant.name,
					role: body.role,
					url,
					t,
				}),
			);

			return json({ id: invitation.id, expiresAt: invitation.expires_at }, { status: 201 });
		},
	});
}
