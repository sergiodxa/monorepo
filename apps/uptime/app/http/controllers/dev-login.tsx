/**
 * The development login for `/dev/login`: a page with one button that signs the browser in as
 * the seeded user, writing the same token set the identity provider's callback writes. Its
 * guard answers 404 unless `DEV_LOGIN=true` and the request is on a loopback host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSession } from "@sdxc/auth/auth-session";
import { sessionOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexCol, gap, items } from "@sdxc/u/layout";
import { m, maxIs, minBs, p } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Button } from "@sdxc/ui";
import { createController } from "remix/router";

import { DEV_USER } from "~/config/dev-user";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** How long the written session lasts, in seconds: a week of local work between logins. */
const SESSION_SECONDS = 60 * 60 * 24 * 7;

/** Encodes text as unpadded base64url, the encoding a compact JWT segment uses. */
function base64url(value: string): string {
	let binary = "";
	for (let byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * An unsigned compact JWT carrying `claims`. A stored token set is read for its claims alone,
 * so the session the app reads is the same shape a provider-signed one has.
 */
function unsignedToken(claims: Record<string, unknown>): string {
	let header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
	return `${header}.${base64url(JSON.stringify(claims))}.`;
}

export default createController(routes.devLogin, {
	actions: {
		/** GET /dev/login — names who the button signs in as. */
		index(ctx) {
			return ctx.render(
				<DocumentLayout assets={ctx.assets} title={ctx.intl.t("page.devLogin.title")}>
					<main mix={[flex(), flexCol(), items("center"), minBs("100vh"), p(16, 4)]}>
						<div
							mix={[
								flex(),
								flexCol(),
								items("center"),
								textAlign("center"),
								gap(3),
								p(12, 8),
								maxIs("32rem"),
								border({ color: "neutral", width: 1, style: "dashed" }),
								rounded("12px"),
							]}
						>
							<h1 mix={[m(0)]}>{ctx.intl.t("page.devLogin.title")}</h1>
							<p mix={[m(0), fg("neutral.muted")]}>
								{ctx.intl.t("page.devLogin.description", { email: DEV_USER.email })}
							</p>
							<form method="post" action={routes.devLogin.action.href()} data-rmx-document="">
								<Button type="submit">
									{ctx.intl.t("page.devLogin.cta", { name: DEV_USER.name })}
								</Button>
							</form>
						</div>
					</main>
				</DocumentLayout>,
			);
		},

		/**
		 * POST /dev/login — rotates the session id, as the provider callback does, writes the
		 * seeded user's token set and lands on the app. The set carries no refresh token, so it
		 * stays signed in on its claims without ever reaching the provider.
		 */
		action(ctx) {
			let expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
			let session = sessionOf(ctx);
			session.regenerateId?.();
			AuthSession.write(session, {
				idToken: unsignedToken({
					sub: DEV_USER.id,
					name: DEV_USER.name,
					email: DEV_USER.email,
					preferred_username: DEV_USER.username,
					exp: expiresAt,
				}),
				accessToken: unsignedToken({ sub: DEV_USER.id, exp: expiresAt }),
				refreshToken: null,
				expiresAt,
			});
			return redirect(routes.app.index.href(), { status: redirect.Status.SeeOther });
		},
	},
});
