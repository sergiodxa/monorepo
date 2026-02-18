import { env } from "cloudflare:workers";
import { redirect } from "react-router";
import { OAuth2Strategy } from "remix-auth-oauth2";

import { verifyIdToken } from "~/entities/id-token";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { getSession } from "~/middleware/session";
import Customer from "~/models/customer";
import Team from "~/models/team";
import { sessionStorage } from "~/session";

type OAuth2Tokens = OAuth2Strategy.VerifyOptions["tokens"];

export function authenticate(request: Request) {
	let url = new URL(request.url);

	let oauth = new OAuth2Strategy(
		{
			clientId: env.CLIENT_ID,
			clientSecret: env.CLIENT_SECRET,
			redirectURI: new URL("/auth", url),
			authorizationEndpoint: new URL("https://auth.sergiodxa.com/authorize"),
			tokenEndpoint: new URL("https://auth.sergiodxa.com/oauth/token"),
			scopes: ["openid", "profile", "email"],
		},
		async (args) => {
			let tokens = getTokens(args.tokens);
			let idToken = await verifyIdToken(tokens.id);
			let teams = await Team.findBySubjectId(db(), idToken.subject);

			let customer = await Customer.findByExternalId(idToken.subject);
			if (!customer) customer = await Customer.findByEmail(idToken.email);
			if (!customer) customer = await Customer.create(idToken);
			if (!customer.externalId) {
				customer = await Customer.assignExternalId(customer.id, idToken.subject);
			}

			if (teams.length > 0) {
				return { id: idToken, idTokenRaw: tokens.id, teams: teams.map((it) => it.id) };
			}

			let team = await Team.joinByDomain(db(), idToken);
			if (team) return { id: idToken, idTokenRaw: tokens.id, teams: [team.id] };

			team = await Team.createTeam(db(), idToken);

			return { id: idToken, idTokenRaw: tokens.id, teams: [team.id] };
		},
	);

	return oauth.authenticate(request);
}

export async function logout() {
	let session = getSession();
	let subjectId = session.get("id");
	let idToken = session.get("idToken");

	// unset just in case
	session.unset("id");
	session.unset("name");
	session.unset("email");
	session.unset("avatar");
	session.unset("idToken");

	logger().info("action.logout.success", { subjectId });

	// Build the auth server logout URL for SSO logout
	let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
	if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
	logoutUrl.searchParams.set("post_logout_redirect_uri", "https://uptime.sergiodxa.com/");

	return redirect(logoutUrl.toString(), {
		headers: {
			"Set-Cookie": await measure("session.destroy", () => {
				return sessionStorage.destroySession(session);
			}),
			"Clear-Site-Data": '"*"',
		},
	});
}

function getTokens(oauthTokens: OAuth2Tokens) {
	if (!oauthTokens.hasRefreshToken()) {
		throw new Error("Failed to access the OAuth2 refresh token");
	}

	return {
		id: oauthTokens.idToken(),
		access: oauthTokens.accessToken(),
		refresh: oauthTokens.refreshToken(),
	};
}
