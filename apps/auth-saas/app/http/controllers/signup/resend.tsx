/**
 * `POST /signup/resend` — re-sends a pending signup's own verification ticket. The
 * unverified address is looked up server-side by the subject id in the URL, never
 * trusted from a value a client-supplied form field could otherwise carry, so a
 * caller cannot resend to an address they don't already control the ticket for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { mailTranslator } from "~/app/mail/locale";
import { PlatformSignupVerifyEmail } from "~/app/mail/platform-signup-verify-email";
import { parseSenderAddress } from "~/app/mail/sender";
import { PublicDocument } from "~/app/views/landing";
import { SignUpPendingPage } from "~/app/views/signup";
import routes from "~/routes/web";

/** Renders the "check your email" state, noting a resend when one went out. */
function renderPending(
	ctx: RequestContext,
	input: { resendAction: string; resent: boolean },
): Promise<Response> {
	return ctx.render(
		<PublicDocument title="Auth SaaS - Check your email">
			<SignUpPendingPage
				resendAction={input.resendAction}
				resent={input.resent}
				sendFailed={false}
			/>
		</PublicDocument>,
	);
}

/**
 * Resends the verification ticket for the subject's own outstanding unverified
 * email. Answers the same "check your email" screen whether or not a fresh ticket
 * actually went out, the same framing an unresolved-but-plausible resend already
 * carries elsewhere in this app.
 *
 * @param ctx - The request context (provides `render` and `mail`).
 * @returns The "check your email" state again, noting the resend when one went out.
 * @example
 * router.map(routes.signup.resend, signupResend);
 */
export default createAction(routes.signup.resend, async (ctx) => {
	let subjectId = ctx.url.searchParams.get("subject");
	let resendAction = subjectId
		? `${routes.signup.resend.href()}?subject=${subjectId}`
		: routes.signup.resend.href();

	if (!subjectId) return renderPending(ctx, { resendAction, resent: false });

	let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);

	let described = await platform.describeSubject({ subjectId, audience: { kind: "subject" } });
	if (!described.ok) return renderPending(ctx, { resendAction, resent: false });

	let unverifiedEmail = described.identifiers.find(
		(identifier) => identifier.kind === "email" && !identifier.verified,
	);
	if (!unverifiedEmail) return renderPending(ctx, { resendAction, resent: false });

	let added = await platform.addIdentifier({
		subjectId,
		kind: "email",
		value: unverifiedEmail.value,
		actor: { kind: "subject" },
	});

	if (added.ok && added.kind === "email") {
		let { t } = mailTranslator();
		let url = new URL(routes.signup.verify.href(), ctx.request.url);
		url.searchParams.set("ticket", added.ticket);

		await ctx.mail.send(
			new PlatformSignupVerifyEmail({ email: added.value, url: url.toString(), t }),
			{ from: parseSenderAddress(env.EMAIL_FROM) },
		);
	}

	return renderPending(ctx, { resendAction, resent: added.ok });
});
