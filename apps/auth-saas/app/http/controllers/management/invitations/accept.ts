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
import { isFailure, unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import { INVITATIONS_ACCEPT } from "~/app/http/openapi/public";
import { requestOrigin } from "~/app/lib/request-origin";
import routes from "~/routes/management";

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
 * `invitationsAccept`, mounted with no auth middleware of its own: the invitation token
 * in the request body is this route's entire credential. An address that collides with a
 * subject created mid-acceptance draws the same refusal as a spent token.
 *
 * @example
 * router.map(routes.invitationsAccept, invitationsAccept);
 */
export default createAction(routes.invitationsAccept, async (ctx) => {
	let input = await INVITATIONS_ACCEPT.parse(ctx.request, ctx.params);
	if (isFailure(input)) return operationInputProblem(input.error);

	let hashed = await sha256(input.data.body.token);
	if (isFailure(hashed)) return invalidInvitation();
	let tokenHash = Hex.encode(hashed.data);

	let invitation = await ctx.models.tenantMemberInvitations.accept({ tokenHash, now: Date.now() });
	if (!invitation) return invalidInvitation();

	let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);

	let resolved = await platform.findSubjectByVerifiedEmail({ email: invitation.email });
	let subjectId = resolved.subjectId;

	if (subjectId === null) {
		let created = await platform.createSubject({
			identifiers: [{ kind: "email", value: invitation.email, verifiedAt: Date.now() }],
		});
		if (!created.ok) return invalidInvitation();
		subjectId = created.subjectId;
	}

	unwrap(
		await ctx.models.memberships.create({
			tenant_id: invitation.tenant_id,
			subject_id: subjectId,
			role: invitation.role,
		}),
	);

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
