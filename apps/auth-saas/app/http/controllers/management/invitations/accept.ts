/**
 * `POST /invitations/accept` — spends a tenant member invitation's own emailed
 * token: resolves or creates the invited address's own platform dashboard
 * subject, grants the real membership the invitation named, and signs that
 * subject into the platform dashboard. Reached by someone holding nothing but
 * the token the invitation's own email carried — no management bearer token
 * names a caller here, the same way an import or export download ticket is the
 * caller's whole credential — so this route names no tenant of its own in its
 * path (the token already names the tenant it was minted for) and is mounted
 * with no `managementAuth` middleware at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex, sha256 } from "@sdxc/crypto";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import { requestOrigin } from "~/app/lib/request-origin";
import Membership from "~/app/models/membership";
import TenantMemberInvitation from "~/app/models/tenant-member-invitation";
import routes from "~/routes/management";

let AcceptInvitationBodySchema = s.object({ token: s.string() });

/**
 * A token that does not spend — unknown, already accepted, or expired alike —
 * the same enumeration-resistant refusal an import or export download's own
 * ticket answers with.
 */
function invalidInvitation(): Response {
	return managementProblem("invalidTicket", {
		detail: "This invitation no longer works.",
	});
}

/**
 * `invitationsAccept`, mounted with no auth middleware of its own: the
 * invitation token in the request body is this route's entire credential.
 *
 * @example
 * router.map(routes.invitationsAccept, invitationsAccept);
 */
export default createAction(routes.invitationsAccept, async (ctx) => {
	let parsed = parseBody(AcceptInvitationBodySchema, await ctx.request.json().catch(() => null));
	if (!parsed.ok) return parsed.response;

	let hashed = await sha256(parsed.data.token);
	if (isFailure(hashed)) return invalidInvitation();
	let tokenHash = Hex.encode(hashed.data);

	let invitation = await TenantMemberInvitation.accept(ctx.db, { tokenHash, now: Date.now() });
	if (!invitation) return invalidInvitation();

	let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);

	let resolved = await platform.findSubjectByVerifiedEmail({ email: invitation.email });
	let subjectId = resolved.subjectId;

	if (subjectId === null) {
		let created = await platform.createSubject({
			identifiers: [{ kind: "email", value: invitation.email, verifiedAt: Date.now() }],
		});
		// Refuses the same way an unresolvable token does: an invitation whose own
		// address collides with a subject created between the lookup above and this
		// call is no more the caller's fault than an already-accepted token is.
		if (!created.ok) return invalidInvitation();
		subjectId = created.subjectId;
	}

	await Membership.create(ctx.db, {
		tenantId: invitation.tenant_id,
		subjectId,
		role: invitation.role,
	});

	let session = await platform.openSessionForSubject({
		subjectId,
		amr: ["invitation"],
		remembered: true,
		...requestOrigin(ctx.request),
	});

	let response = json({ tenantId: invitation.tenant_id, role: invitation.role }, { status: 200 });
	response.headers.append("Set-Cookie", await serializeSessionCookie(session, true));

	return response;
});
