import type { Handle, RemixNode } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import { css } from "remix/ui";

import {
	buildAuthorizationUrl,
	createPkce,
	exchangeCode,
	resolveMetadata,
	verifyIdToken,
} from "../../auth/oidc";
import { User } from "../../domain/user";
import routes from "../../routes";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
import { getIdToken, getSession, login, logout, setIdToken } from "../../shared/middleware/auth";

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
				<body
					mix={[
						css({
							fontFamily: "system-ui, sans-serif",
							maxWidth: "24rem",
							margin: "6rem auto",
							padding: "0 1rem",
							textAlign: "center",
						}),
					]}
				>
					{error && <p mix={[css({ color: "#b91c1c", marginBottom: "1rem" })]}>{error}</p>}
					{children}
				</body>
			</html>
		);
	};
}

function safeNext(value: string | null): string | undefined {
	return value && value.startsWith("/") ? value : undefined;
}

/** GET /auth/login — renders the sign-in screen. */
export const loginIndex = action<"GET", "/auth/login">(async ({ request }) => {
	let url = new URL(request.url);
	let next = url.searchParams.get("next");
	let errorParam = url.searchParams.get("error");
	let formAction =
		routes.auth.login.action.href() + (next ? `?next=${encodeURIComponent(next)}` : "");
	let body = await renderDocument(
		<AuthPage title="Sign in" error={errorParam ?? undefined}>
			<h1>Sign in</h1>
			<form method="post" action={formAction}>
				<button type="submit">Continue</button>
			</form>
		</AuthPage>,
	);
	return ok(body);
});

/** POST /auth/login — starts the OIDC authorization-code + PKCE flow. */
export const loginStart = action<"POST", "/auth/login">(async ({ request, oidc }) => {
	let metadata = await resolveMetadata(oidc);
	let pkce = await createPkce();
	let state = crypto.randomUUID();
	let redirectUri = new URL(routes.auth.callback.href(), request.url).toString();
	let next = safeNext(new URL(request.url).searchParams.get("next"));

	let session = getSession();
	let transaction: AuthTransaction = {
		provider: "oidc",
		state,
		codeVerifier: pkce.verifier,
		returnTo: next,
	};
	session.set("__auth", transaction);

	let authorizeUrl = buildAuthorizationUrl(metadata, {
		clientId: oidc.clientId,
		redirectUri,
		scopes: oidc.scopes,
		state,
		challenge: pkce.challenge,
	});
	return redirect(authorizeUrl, { status: redirect.Status.SeeOther });
});

/** GET /auth/callback — completes the flow and establishes the local session. */
export const callback = action<"GET", "/auth/callback">(async ({ db, request, oidc, logger }) => {
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

/** GET /auth/logout — renders the sign-out confirmation. */
export const logoutIndex = action<"GET", "/auth/logout">(async () => {
	let body = await renderDocument(
		<AuthPage title="Sign out">
			<h1>Sign out</h1>
			<form method="post" action={routes.auth.logout.action.href()}>
				<button type="submit">Sign out</button>
			</form>
		</AuthPage>,
	);
	return ok(body);
});

/** POST /auth/logout — clears the session and redirects through the IdP logout. */
export const logoutAction = action<"POST", "/auth/logout">(async ({ request, oidc }) => {
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
});
