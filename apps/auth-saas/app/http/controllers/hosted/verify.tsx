/**
 * `GET /u/verify` — the landing page a verification link lands on (`?ticket=`),
 * and the "check your email" state `/u/sign-up` lands on (`?subject=`); `POST
 * /u/verify/resend` is that state's own resend control. Nothing is signed in
 * at either point, so the resend reads the subject's own unverified email
 * back through `describeSubject` and mints a fresh ticket for that same
 * address — a subject id alone grants no capability, since every write here
 * still runs through the subject's own row rather than a client-supplied value.
 * A resend sends the fresh ticket over mail the same way the original did; the
 * response says a link went out whether or not a fresh one actually did, the
 * same framing an unresolved-but-plausible resend already carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { createAction } from "remix/router";

import { redirectToErrorPage } from "~/app/http/controllers/hosted/outcome";
import { verifyAddressLink } from "~/app/mail/links";
import { senderAddressFor, senderNameFromIssuer } from "~/app/mail/sender";
import { VerifyAddressEmail } from "~/app/mail/verify-address-email";
import { HostedDocument } from "~/app/views/hosted/document";
import { VerifyPage } from "~/app/views/hosted/verify";
import routes from "~/routes/tenant";

/** Builds an absolute URL for one of this tenant's routes, carrying the current request's query along. */
function actionUrl(ctx: RequestContext, path: string): string {
	let url = new URL(path, ctx.request.url);
	for (let [key, value] of ctx.url.searchParams) url.searchParams.set(key, value);
	return url.toString();
}

/** Renders the "check your email" state for the subject its `subject` query parameter names. */
function renderPending(
	ctx: RequestContext,
	input: { resent: boolean; sendFailed?: boolean },
): Promise<Response> {
	let t = ctx.i18next.t;

	return ctx.render(
		<HostedDocument title={t("hostedVerify.title")} locale={ctx.locale}>
			<VerifyPage
				t={t}
				state="pending"
				resendAction={actionUrl(ctx, routes.hostedVerifyResend.href())}
				resent={input.resent}
				sendFailed={input.sendFailed ?? false}
			/>
		</HostedDocument>,
	);
}

/**
 * Spends the ticket a verification link carries, or renders the "check your
 * email" state for a subject id fresh off `/u/sign-up`.
 *
 * @param ctx - The request context (provides `render`, `locale`, `i18next` and `tenantStub`).
 * @returns The rendered verify screen, or `/u/error` when the request names neither.
 * @example
 * router.map(routes.hostedVerifyShow, verifyShow);
 */
export const verifyShow = createAction(routes.hostedVerifyShow, async (ctx) => {
	let t = ctx.i18next.t;
	let ticket = ctx.url.searchParams.get("ticket");

	if (ticket) {
		let verified = await ctx.tenantStub.verifyIdentifier({ ticket });

		return ctx.render(
			<HostedDocument title={t("hostedVerify.title")} locale={ctx.locale}>
				<VerifyPage t={t} state={verified.ok ? "verified" : "invalid"} />
			</HostedDocument>,
			verified.ok ? undefined : { status: 400 },
		);
	}

	if (!ctx.url.searchParams.get("subject")) {
		return redirectToErrorPage(ctx, t("hostedVerify.errors.missingState"));
	}

	let sendFailed = ctx.url.searchParams.get("sendFailed") === "1";
	return renderPending(ctx, { resent: false, sendFailed });
});

/**
 * Resends the verification ticket for the subject's own outstanding
 * unverified email, looked up by id rather than trusted from a value the
 * form would otherwise have to carry.
 *
 * @param ctx - The request context (provides `render`, `locale`, `i18next` and `tenantStub`).
 * @returns The "check your email" state again, noting the resend when one went out.
 * @example
 * router.map(routes.hostedVerifyResend, verifyResend);
 */
export const verifyResend = createAction(routes.hostedVerifyResend, async (ctx) => {
	let t = ctx.i18next.t;
	let subjectId = ctx.url.searchParams.get("subject");

	if (!subjectId) {
		return redirectToErrorPage(ctx, t("hostedVerify.errors.missingState"));
	}

	let described = await ctx.tenantStub.describeSubject({
		subjectId,
		audience: { kind: "subject" },
	});
	if (!described.ok) return renderPending(ctx, { resent: false });

	let unverifiedEmail = described.identifiers.find(
		(identifier) => identifier.kind === "email" && !identifier.verified,
	);
	if (!unverifiedEmail) return renderPending(ctx, { resent: false });

	let added = await ctx.tenantStub.addIdentifier({
		subjectId,
		kind: "email",
		value: unverifiedEmail.value,
		actor: { kind: "subject" },
	});

	if (added.ok && added.kind === "email") {
		await ctx.email.send(
			new VerifyAddressEmail({
				email: added.value,
				url: verifyAddressLink(ctx, added.ticket),
				tenantName: senderNameFromIssuer(ctx.tenant.issuer),
				t,
			}),
			{ from: senderAddressFor(ctx) },
		);
	}

	return renderPending(ctx, { resent: added.ok });
});
