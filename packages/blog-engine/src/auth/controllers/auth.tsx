import type { Handle, RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { createAction, createController } from "remix/fetch-router";

import routes from "../../routes";
import * as s from "../../shared/components/styles";
import { User } from "../../users/models/user";
import { getIdToken, getSession, login, logout, setIdToken } from "../middleware/auth";
import {
	buildAuthorizationUrl,
	createPkce,
	exchangeCode,
	resolveMetadata,
	verifyIdToken,
} from "../oidc";

/** OIDC PKCE transaction stored in the session between login start and callback. */
interface AuthTransaction {
	provider: string;
	state: string;
	codeVerifier: string;
	returnTo?: string;
}

/** Standalone centered page shell for the auth screens. */
function AuthPage(handle: Handle<{ title: string; error?: string; children: RemixNode }>) {
	return () => {
		let { title, error, children } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
				</head>
				<body mix={[s.authBody]}>
					{error && <p mix={[s.errorText]}>{error}</p>}
					{children}
				</body>
			</html>
		);
	};
}

function safeNext(value: string | null): string | undefined {
	return value && value.startsWith("/") ? value : undefined;
}

/** `/auth/login` — renders the sign-in screen (GET) and starts the flow (POST). */
export const login = createController(routes.auth.login, {
	actions: {
		async index(ctx) {
			let url = new URL(ctx.request.url);
			let next = url.searchParams.get("next");
			let errorParam = url.searchParams.get("error");
			let formAction =
				routes.auth.login.action.href() + (next ? `?next=${encodeURIComponent(next)}` : "");
			return ctx.render(
				<AuthPage title="Sign in" error={errorParam ?? undefined}>
					<h1>Sign in</h1>
					<form method="post" action={formAction}>
						<button mix={[s.button]} type="submit">
							Continue
						</button>
					</form>
				</AuthPage>,
			);
		},

		async action(ctx) {
			let { request, oidc } = ctx;
			let metadata = await resolveMetadata(oidc);
			let pkce = await createPkce();
			let state = crypto.randomUUID();
			let redirectUri = new URL(routes.auth.callback.href(), request.url).toString();
			let next = safeNext(new URL(request.url).searchParams.get("next"));

			let transaction: AuthTransaction = {
				provider: "oidc",
				state,
				codeVerifier: pkce.verifier,
				returnTo: next,
			};
			getSession().set("__auth", transaction);

			let authorizeUrl = buildAuthorizationUrl(metadata, {
				clientId: oidc.clientId,
				redirectUri,
				scopes: oidc.scopes,
				state,
				challenge: pkce.challenge,
			});
			return redirect(authorizeUrl, { status: redirect.Status.SeeOther });
		},
	},
});

/** GET /auth/callback — completes the flow and establishes the local session. */
export const callback = createAction(routes.auth.callback, async (ctx) => {
	let { db, request, oidc, logger } = ctx;
	let log = logger.loader("/auth/callback");
	let url = new URL(request.url);
	let session = getSession();
	let transaction = session.get("__auth") as AuthTransaction | undefined;
	let loginUrl = routes.auth.login.index.href();

	let providerError = url.searchParams.get("error");
	if (providerError) {
		return redirect(`${loginUrl}?error=${encodeURIComponent(providerError)}`, {
			status: redirect.Status.SeeOther,
		});
	}
	if (!transaction) {
		return redirect(`${loginUrl}?error=missing_transaction`, { status: redirect.Status.SeeOther });
	}

	let state = url.searchParams.get("state");
	let code = url.searchParams.get("code");
	session.unset("__auth");
	if (!state || !code || state !== transaction.state) {
		return redirect(`${loginUrl}?error=invalid_request`, { status: redirect.Status.SeeOther });
	}

	try {
		let metadata = await resolveMetadata(oidc);
		let redirectUri = new URL(routes.auth.callback.href(), request.url).toString();
		let { idToken } = await exchangeCode(metadata, {
			clientId: oidc.clientId,
			clientSecret: oidc.clientSecret,
			code,
			codeVerifier: transaction.codeVerifier,
			redirectUri,
		});
		let profile = verifyIdToken(idToken, { issuer: oidc.issuer, clientId: oidc.clientId });
		let user = await User.findOrCreateFromAuthProfile(db, profile, { admins: oidc.admins });
		login(user);
		setIdToken(idToken);
		log.info("Login completed", { userId: user.id });
	} catch (error) {
		log.error("Login failed", { error: String(error) });
		return redirect(`${loginUrl}?error=authentication_failed`, {
			status: redirect.Status.SeeOther,
		});
	}

	let returnTo = safeNext(transaction.returnTo ?? null) ?? routes.cms.dashboard.href();
	return redirect(returnTo, { status: redirect.Status.SeeOther });
});

/** `/auth/logout` — sign-out confirmation (GET) and session teardown (POST). */
export const logout_ = createController(routes.auth.logout, {
	actions: {
		async index(ctx) {
			return ctx.render(
				<AuthPage title="Sign out">
					<h1>Sign out</h1>
					<form method="post" action={routes.auth.logout.action.href()}>
						<button mix={[s.button]} type="submit">
							Sign out
						</button>
					</form>
				</AuthPage>,
			);
		},

		async action(ctx) {
			let { request, oidc } = ctx;
			let idToken = getIdToken();
			let origin = new URL(request.url).origin;
			let metadata = await resolveMetadata(oidc).catch(() => null);
			logout();

			if (metadata?.end_session_endpoint) {
				let logoutUrl = new URL(metadata.end_session_endpoint);
				if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
				logoutUrl.searchParams.set("post_logout_redirect_uri", `${origin}/`);
				return redirect(logoutUrl.toString(), {
					status: redirect.Status.SeeOther,
					headers: { "Clear-Site-Data": '"*"' },
				});
			}
			return redirect("/", { status: redirect.Status.SeeOther });
		},
	},
});
