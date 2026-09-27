/**
 * `GET /signup/verify` — spends a signup's verification ticket and, only once that
 * succeeds, provisions the tenant its pending row named: a customer, a tenant, and an
 * owning membership, followed by a signed-in session. Provisioning waits behind
 * `verifyIdentifier` rather than running at submission time, so an unauthenticated
 * `/signup` post can never spend a Durable Object provision on an address nobody has
 * proven yet.
 *
 * `verifyIdentifier` itself spends the ticket atomically, so a replay of the same
 * ticket finds no `pending_signups` row left to provision from and answers with the
 * same refusal an unknown or expired ticket gets — a caller can never tell a spent
 * ticket apart from one that was never valid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { serializeSessionCookie } from "~/app/http/middleware/hosted-session";
import { requestOrigin } from "~/app/lib/request-origin";
import Customer from "~/app/models/customer";
import Membership from "~/app/models/membership";
import PendingSignup from "~/app/models/pending-signup";
import { provisionTenant } from "~/app/services/tenant-provisioning";
import { PublicDocument } from "~/app/views/landing";
import { SignUpCompletePage, SignUpInvalidPage, SignUpPendingPage } from "~/app/views/signup";
import routes from "~/routes/tenant";
import webRoutes from "~/routes/web";

/** The "invalid or expired ticket" state: unknown, expired, and already-spent alike. */
function renderInvalid(ctx: RequestContext): Promise<Response> {
	return ctx.render(
		<PublicDocument title="Auth SaaS - Verification link">
			<SignUpInvalidPage />
		</PublicDocument>,
		{ status: 400 },
	);
}

/**
 * Spends `?ticket=`, provisions the tenant the matching pending signup named, opens a
 * platform session for its new owner, and renders the confirmation screen. Renders the
 * "check your email" state for a request that carries a `?subject=` instead, and the
 * invalid state for one that carries neither.
 *
 * @param ctx - The request context (provides `render` and `db`).
 * @returns The confirmation screen with a `Set-Cookie` session on success, the
 * "check your email" state for a subject with no ticket yet, or the invalid state.
 * @example
 * router.map(routes.signup.verify, signupVerify);
 */
export default createAction(webRoutes.signup.verify, async (ctx) => {
	let ticket = ctx.url.searchParams.get("ticket");

	if (!ticket) {
		let subjectId = ctx.url.searchParams.get("subject");
		if (!subjectId) return renderInvalid(ctx);

		return ctx.render(
			<PublicDocument title="Auth SaaS - Check your email">
				<SignUpPendingPage
					resendAction={`${webRoutes.signup.resend.href()}?subject=${subjectId}`}
					resent={false}
					sendFailed={false}
				/>
			</PublicDocument>,
		);
	}

	let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);
	let verified = await platform.verifyIdentifier({ ticket });
	if (!verified.ok) return renderInvalid(ctx);

	let pending = await PendingSignup.findBySubjectId(ctx.db, verified.subjectId);
	if (!pending) return renderInvalid(ctx);

	let customer = await Customer.create(ctx.db, { name: pending.organization_name });
	let tenant = await provisionTenant(ctx.db, {
		customerId: customer.id,
		name: pending.organization_name,
	});
	await Membership.create(ctx.db, {
		tenantId: tenant.id,
		subjectId: verified.subjectId,
		role: "owner",
	});
	await PendingSignup.deleteBySubjectId(ctx.db, verified.subjectId);

	let session = await platform.openSessionForSubject({
		subjectId: verified.subjectId,
		amr: ["signup"],
		remembered: true,
		...requestOrigin(ctx.request),
	});

	let signInUrl = new URL(routes.hostedSignInShow.href(), `https://${env.PLATFORM_DOMAIN}`);
	signInUrl.searchParams.set("return_to", "/");
	let tenantHostname = new URL(tenant.issuer).hostname;

	let response = await ctx.render(
		<PublicDocument title="Auth SaaS - You're all set">
			<SignUpCompletePage tenantHostname={tenantHostname} signInUrl={signInUrl.toString()} />
		</PublicDocument>,
	);
	response.headers.append("Set-Cookie", await serializeSessionCookie(session, true));

	return response;
});
