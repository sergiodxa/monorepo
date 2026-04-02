import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { Auth } from "remix/auth-middleware";
import { renderToString } from "remix/component/server";

import { BlogLayout } from "~/components/layout/blog";
import { verifyIdToken } from "~/entities/id-token";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { User } from "~/models/user";
import { finishAuth, startAuth } from "~/modules/oauth";
import routes from "~/routes";
import { LoginView } from "~/views/auth/login";
import { LogoutView } from "~/views/auth/logout";

export default controller<typeof routes.auth>({
	middleware: [
		async (ctx) => {
			let auth = ctx.get(Auth);
			if (auth.ok) {
				return redirect(routes.cms.dashboard.href(), { status: redirect.Status.SeeOther });
			}
		},
	],
	actions: {
		login: {
			middleware: [],
			actions: {
				async index() {
					let body = await renderToString(
						<BlogLayout
							title="Login"
							description="Authenticate to access CMS tools"
							activePath={routes.auth.login.index.href()}
						>
							<LoginView />
						</BlogLayout>,
					);

					return ok(body);
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
					let body = await renderToString(
						<BlogLayout
							title="Logout"
							description="Sign out from CMS"
							activePath={routes.auth.logout.index.href()}
						>
							<LogoutView />
						</BlogLayout>,
					);

					return ok(body);
				},

				action(ctx) {
					let auth = authState();

					let idToken = auth.getIdToken();
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

					auth.logout();

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
					let body = await renderToString(
						<BlogLayout
							title="Login"
							description="Authenticate to access CMS tools"
							activePath={routes.auth.login.index.href()}
						>
							<LoginView error="Authentication failed. Please try again." />
						</BlogLayout>,
					);

					return ok(body);
				}

				let idTokenRaw = result.idToken;
				if (!idTokenRaw) {
					let body = await renderToString(
						<BlogLayout
							title="Login"
							description="Authenticate to access CMS tools"
							activePath={routes.auth.login.index.href()}
						>
							<LoginView error="Authentication failed. Missing token response." />
						</BlogLayout>,
					);

					return ok(body);
				}

				let idToken = await verifyIdToken(idTokenRaw);
				let user = await User.findOrCreateFromAuthProfile(db(), {
					subjectId: idToken.subject,
					email: idToken.email,
					avatar: idToken.picture,
					username: idToken.username,
					displayName: idToken.name,
				});

				authState().login(user);
				authState().setIdToken(idTokenRaw);

				let returnTo =
					result.returnTo && result.returnTo.startsWith("/")
						? result.returnTo
						: routes.cms.dashboard.href();
				return redirect(returnTo, { status: redirect.Status.SeeOther });
			},
		},
	},
});
