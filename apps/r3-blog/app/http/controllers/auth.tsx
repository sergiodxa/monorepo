import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";

import { finishAuth, startAuth } from "~/app/auth/services/oauth";
import { verifyIdToken } from "~/app/auth/value-objects/id-token";
import { getIdToken, isAuthenticated, login, logout, setIdToken } from "~/app/http/middleware/auth";
import { db } from "~/app/http/middleware/db";
import { view } from "~/app/infrastructure/view";
import { User } from "~/app/repositories/user";
import { LoginView } from "~/resources/views/auth/login";
import { LogoutView } from "~/resources/views/auth/logout";
import routes from "~/routes/web";

export default controller<typeof routes.auth>({
	middleware: [
		async () => {
			if (isAuthenticated()) {
				return redirect(routes.cms.dashboard.href(), { status: redirect.Status.SeeOther });
			}
		},
	],
	actions: {
		login: {
			middleware: [],
			actions: {
				async index() {
					return view(LoginView, {});
				},

				action(ctx) {
					return startAuth(ctx);
				},
			},
		},

		logout: {
			middleware: [],
			actions: {
				async index() {
					return view(LogoutView, {});
				},

				action(ctx) {
					let idToken = getIdToken();
					let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
					if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
					logoutUrl.searchParams.set(
						"post_logout_redirect_uri",
						new URL(routes.feed.href(), ctx.request.url).toString(),
					);

					let response = redirect(logoutUrl, {
						status: redirect.Status.SeeOther,
						headers: {
							"Clear-Site-Data": '"*"',
						},
					});

					logout();

					return response;
				},
			},
		},

		callback: {
			middleware: [],
			async handler(ctx) {
				let result: Awaited<ReturnType<typeof finishAuth>>;

				try {
					result = await finishAuth(ctx);
				} catch {
					return view(LoginView, { error: "Authentication failed. Please try again." });
				}

				let idTokenRaw = result.idToken;
				if (!idTokenRaw) {
					return view(LoginView, { error: "Authentication failed. Missing token response." });
				}

				let idToken = await verifyIdToken(idTokenRaw);
				let user = await User.findOrCreateFromAuthProfile(db(), {
					subjectId: idToken.subject,
					email: idToken.email,
					avatar: idToken.picture,
					username: idToken.username,
					displayName: idToken.name,
				});

				login(user);
				setIdToken(idTokenRaw);

				let returnTo =
					result.returnTo && result.returnTo.startsWith("/")
						? result.returnTo
						: routes.cms.dashboard.href();
				return redirect(returnTo, { status: redirect.Status.SeeOther });
			},
		},
	},
});
