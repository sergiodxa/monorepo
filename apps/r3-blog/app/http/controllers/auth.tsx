import { JWK } from "@edgefirst-dev/jwt";
import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";
import { getContext } from "remix/async-context-middleware";
import { startExternalAuth } from "remix/auth";
import { Session } from "remix/session";

import { createProvider, exchangeCodeForIdToken } from "~/app/auth/services/oauth";
import { verifyIdToken } from "~/app/auth/value-objects/id-token";
import { getIdToken, isAuthenticated, login, logout, setIdToken } from "~/app/http/middleware/auth";
import { db } from "~/app/http/middleware/db";
import { getEnv } from "~/app/http/middleware/env";
import { view } from "~/app/infrastructure/view";
import { User } from "~/app/repositories/user";
import { LoginView } from "~/resources/views/auth/login";
import { LogoutView } from "~/resources/views/auth/logout";
import routes from "~/routes/web";

interface OAuthTransaction {
	provider: string;
	state: string;
	codeVerifier: string;
	returnTo?: string;
}

let idTokenVerificationKey = JWK.importRemote(
	new URL("https://auth.sergiodxa.com/.well-known/jwks.json"),
	{ alg: JWK.Algoritm.ES256 },
);

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

				action() {
					let ctx = getContext() as any;
					let provider = createProvider({
						auth: {
							clientId: getEnv("CLIENT_ID"),
							clientSecret: getEnv("CLIENT_SECRET"),
						},
						redirectUri: new URL(routes.auth.callback.href(), ctx.request.url).toString(),
					});
					let returnTo = ctx.url.searchParams.get("next");
					return startExternalAuth(provider, ctx, { returnTo });
				},
			},
		},

		logout: {
			middleware: [],
			actions: {
				async index() {
					return view(LogoutView, {});
				},

				action() {
					let ctx = getContext() as any;
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
			async handler() {
				let ctx = getContext() as any;
				let result: Awaited<ReturnType<typeof exchangeCodeForIdToken>>;
				let session = ctx.get(Session);
				let transaction = session.get("__auth") as OAuthTransaction | null;
				let callbackError = ctx.url.searchParams.get("error");
				if (callbackError) {
					return view(LoginView, {
						error: ctx.url.searchParams.get("error_description") ?? callbackError,
					});
				}
				if (!transaction || transaction.provider !== "sergiodxa") {
					return view(LoginView, { error: "Authentication failed. Missing transaction." });
				}
				let state = ctx.url.searchParams.get("state");
				let code = ctx.url.searchParams.get("code");
				if (!state || !code) {
					session.unset("__auth");
					return view(LoginView, { error: "Authentication failed. Missing callback params." });
				}
				if (state !== transaction.state) {
					session.unset("__auth");
					return view(LoginView, { error: "Authentication failed. Invalid state." });
				}

				try {
					result = await exchangeCodeForIdToken({
						auth: {
							clientId: getEnv("CLIENT_ID"),
							clientSecret: getEnv("CLIENT_SECRET"),
						},
						code,
						codeVerifier: transaction.codeVerifier,
						redirectUri: new URL(routes.auth.callback.href(), ctx.request.url).toString(),
					});
					session.unset("__auth");
				} catch {
					session.unset("__auth");
					return view(LoginView, { error: "Authentication failed. Please try again." });
				}

				let idTokenRaw = result.idToken;
				if (!idTokenRaw) {
					return view(LoginView, { error: "Authentication failed. Missing token response." });
				}

				let idToken = await verifyIdToken(
					idTokenRaw,
					await idTokenVerificationKey,
					getEnv("CLIENT_ID"),
				);
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
					transaction.returnTo && transaction.returnTo.startsWith("/")
						? transaction.returnTo
						: routes.cms.dashboard.href();
				return redirect(returnTo, { status: redirect.Status.SeeOther });
			},
		},
	},
});
