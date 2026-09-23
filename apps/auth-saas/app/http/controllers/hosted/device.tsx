/**
 * `GET/POST /device` — RFC 8628's verification URI: a person enters or
 * confirms the code their device is showing, and approves or denies the
 * sign-in it asked for. There is no interaction row to park here the way
 * `/authorize` parks one, since nothing but the code itself is in flight, so a
 * session-less visit carries a `return_to` back to this same request instead
 * of a resumable interaction id, and the consent step reuses `ConsentScreen`
 * and its rendering exactly the way `/u/consent` does — one surface and one
 * set of copy, whether the approval came from a browser or a device.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { redirectToErrorPage, renderConsentPage } from "~/app/http/controllers/hosted/outcome";
import { activeSession } from "~/app/http/middleware/hosted-session";
import { DeviceCodePage, DeviceDonePage } from "~/app/views/hosted/device";
import { HostedDocument } from "~/app/views/hosted/document";
import routes from "~/routes/tenant";

/** The `/device` request this session-less visit should return to once signed in. */
function ownReturnTo(ctx: { request: Request }, userCode: string | null): string {
	let url = new URL(routes.hostedDeviceShow.href(), ctx.request.url);
	if (userCode) url.searchParams.set("user_code", userCode);
	return url.pathname + url.search;
}

/** A real `302` to `/u/sign-in`, carrying this request's own `return_to` path. */
function redirectToSignIn(ctx: { request: Request }, userCode: string | null): Response {
	let url = new URL(routes.hostedSignInShow.href(), ctx.request.url);
	url.searchParams.set("return_to", ownReturnTo(ctx, userCode));
	return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

/**
 * Renders the code-entry form for no session or no code yet, or the consent
 * screen once both are in hand — approving from a device is always something
 * an authenticated person did, so a session-less visit is sent to sign in and
 * back rather than shown anything about the code it named.
 *
 * @param ctx - The request context (provides `tenantStub`, `render` and `request`).
 * @returns The response this GET reaches on its own.
 * @example
 * router.map(routes.hostedDeviceShow, hostedDeviceShow);
 */
export const hostedDeviceShow = createAction(routes.hostedDeviceShow, async (ctx) => {
	let t = ctx.intl.t;
	let userCode = ctx.url.searchParams.get("user_code");

	let session = await activeSession(ctx);
	if (!session) return redirectToSignIn(ctx, userCode);

	if (!userCode) {
		return ctx.render(
			<HostedDocument title={t("hostedDevice.title")} locale={ctx.locale}>
				<DeviceCodePage
					t={t}
					action={routes.hostedDeviceShow.href()}
					defaultUserCode={null}
					error={null}
				/>
			</HostedDocument>,
		);
	}

	let begun = await ctx.tenantStub.beginDeviceApproval({
		userCode,
		sessionId: session.sessionId,
		now: Date.now(),
	});

	if (!begun.ok) {
		let error =
			begun.reason === "expired"
				? t("hostedDevice.errors.expired")
				: t("hostedDevice.errors.unknown");

		return ctx.render(
			<HostedDocument title={t("hostedDevice.title")} locale={ctx.locale}>
				<DeviceCodePage
					t={t}
					action={routes.hostedDeviceShow.href()}
					defaultUserCode={userCode}
					error={error}
				/>
			</HostedDocument>,
			{ status: 400 },
		);
	}

	let action = new URL(routes.hostedDeviceSubmit.href(), ctx.request.url);
	action.searchParams.set("device", begun.deviceAuthorizationId);

	return renderConsentPage(ctx, action.toString(), begun.screen);
});

/**
 * Records the submitted approve/deny decision and renders the confirmation a
 * person leaves this screen on either way. The form carries the pending row's
 * own id rather than the code, the same way `/u/consent`'s own form carries an
 * interaction id rather than resubmitting whatever a client first asked for.
 *
 * @param ctx - The request context (provides `tenantStub`, `formData` and `render`).
 * @returns The response this POST reaches on its own.
 * @example
 * router.map(routes.hostedDeviceSubmit, hostedDeviceSubmit);
 */
export const hostedDeviceSubmit = createAction(routes.hostedDeviceSubmit, async (ctx) => {
	let t = ctx.intl.t;
	let deviceAuthorizationId = ctx.url.searchParams.get("device");
	if (!deviceAuthorizationId) {
		return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));
	}

	let session = await activeSession(ctx);
	if (!session) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	let approved = ctx.formData.get("decision") !== "deny";

	let decided = await ctx.tenantStub.decideDeviceApproval({
		deviceAuthorizationId,
		sessionId: session.sessionId,
		approved,
		now: Date.now(),
	});

	if (!decided.ok) return redirectToErrorPage(ctx, t("hostedError.invalidInteraction"));

	return ctx.render(
		<HostedDocument
			title={
				decided.approved ? t("hostedDevice.done.approvedTitle") : t("hostedDevice.done.deniedTitle")
			}
			locale={ctx.locale}
		>
			<DeviceDonePage t={t} approved={decided.approved} />
		</HostedDocument>,
	);
});
