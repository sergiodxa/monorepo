/**
 * The development login for `/dev/login`: a page with one button that signs the browser in as
 * the seeded admin, creating that account and its seed content on first use. Its guard answers
 * 404 unless `DEV_LOGIN=true` and the request is on a loopback host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSession } from "@sdxc/auth/auth-session";
import { sessionOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { unwrap } from "@sdxc/result";
import { createController } from "remix/router";

import { login } from "~/app/http/middleware/auth";
import { getEnv } from "~/app/http/middleware/env";
import { DEV_ADMIN } from "~/config/dev-user";
import { seedDevContent } from "~/database/seed";
import { DevLoginView } from "~/resources/views/auth/dev-login";
import routes from "~/routes/web";

/** How long the written session lasts, in seconds: a week of local work between logins. */
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export default createController(routes.devLogin, {
	actions: {
		/** GET /dev/login — names who the button signs in as. */
		index(ctx) {
			return ctx.render(DevLoginView, {});
		},

		/**
		 * POST /dev/login — finds or creates the admin, seeding content when it is new, then
		 * signs in under a fresh session id with a token set that carries no refresh token, so
		 * the session stays valid on its own and never reaches the provider.
		 */
		async action(ctx) {
			let user = await ctx.models.users.findBySubjectId(DEV_ADMIN.subjectId);

			if (user === null) {
				user = unwrap(
					await ctx.models.users.create({
						subject_id: DEV_ADMIN.subjectId,
						role: "admin",
						email: DEV_ADMIN.email,
						avatar: DEV_ADMIN.avatar,
						username: DEV_ADMIN.username,
						display_name: DEV_ADMIN.displayName,
					}),
				);
				await seedDevContent(ctx.models, user.id, getEnv("REDIRECTS"));
			}

			login(user);
			AuthSession.write(sessionOf(ctx), {
				idToken: "dev-id-token",
				accessToken: "dev-access-token",
				refreshToken: null,
				expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
			});

			return redirect(routes.cms.dashboard.href(), { status: redirect.Status.SeeOther });
		},
	},
});
