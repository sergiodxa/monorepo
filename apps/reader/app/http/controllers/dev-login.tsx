/**
 * Development sign-in for `/dev/login`: a page with one button that signs this machine in
 * as the seed reader, so the signed-in app can be run and checked locally without the
 * identity provider. Off the local switch or off a local host it answers the 404 page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSession } from "@sdxc/auth/auth-session";
import { sessionOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { maxIs, mi, minBs, p } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Button, Heading, Text } from "@sdxc/ui";
import { createController } from "remix/router";
import { Session } from "remix/session";

import defaultHandler from "~/app/http/controllers/default-handler";
import { writePresentation } from "~/app/initializers/cookies";
import { userStore } from "~/app/models/user-store";
import { devLoginEnabled } from "~/app/services/dev-login";
import { SEED_USER, seedReader } from "~/database/seed";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** How long a development session lasts before the browser has to sign in again. */
const SESSION_SECONDS = 60 * 60 * 24 * 30;

/**
 * Encodes `claims` as an unsecured JWT. The session decodes its ID token for the reader's
 * subject, name and address, and only the provider's callback checks a signature, so a
 * token this route writes stands for the seed reader on every later request.
 */
function unsecuredToken(claims: Record<string, unknown>): string {
	let encode = (part: unknown) =>
		btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(part))))
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replaceAll("=", "");
	return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;
}

export default createController(routes.devLogin, {
	actions: {
		/** GET /dev/login — the page naming who the button signs in as. */
		index(ctx) {
			if (!devLoginEnabled(ctx.url)) return defaultHandler(ctx);

			let title = ctx.intl.t("auth.dev.title");

			return ctx.render(
				<DocumentLayout assets={ctx.assets} title={title} locale={ctx.locale}>
					<main
						mix={[
							vstack({ gap: 4, align: "center", justify: "center" }),
							minBs("100dvh"),
							maxIs("36rem"),
							mi("auto"),
							p(8),
							textAlign("center"),
						]}
					>
						<Heading level={1}>{title}</Heading>
						<Text mix={[fg("neutral.muted")]}>
							{ctx.intl.t("auth.dev.description", {
								name: SEED_USER.name,
								email: SEED_USER.email,
							})}
						</Text>
						<form method="post" action={routes.devLogin.action.href()} data-rmx-document="">
							<Button type="submit">{ctx.intl.t("auth.dev.cta")}</Button>
						</form>
					</main>
				</DocumentLayout>,
			);
		},

		/**
		 * POST /dev/login — writes the session the provider's callback would, naming the seed
		 * reader, seeds their library the first time, and lands on the queue like a sign-in.
		 */
		async action(ctx) {
			if (!devLoginEnabled(ctx.url)) return defaultHandler(ctx);

			let expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
			let idToken = unsecuredToken({
				iss: ctx.url.origin,
				aud: "reader-dev",
				sub: SEED_USER.subject,
				name: SEED_USER.name,
				email: SEED_USER.email,
				iat: Math.floor(Date.now() / 1000),
				exp: expiresAt,
			});

			ctx.get(Session)?.regenerateId(true);
			AuthSession.write(sessionOf(ctx), {
				idToken,
				accessToken: "dev-login",
				refreshToken: null,
				expiresAt,
			});

			await seedReader();

			let reader = await userStore(SEED_USER.subject).ensureUser(
				SEED_USER.subject,
				SEED_USER.email,
			);

			return redirect(routes.reading.index.href(), {
				status: redirect.Status.SeeOther,
				headers: { "Set-Cookie": await writePresentation(reader.presentation) },
			});
		},
	},
});
