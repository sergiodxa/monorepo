import { env } from "cloudflare:workers";
import { href, redirect } from "react-router";
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
				return { id: idToken, teams: teams.map((it) => it.id) };
			}

			let team = await Team.joinByDomain(db(), idToken);
			if (team) return { id: idToken, teams: [team.id] };

			team = await Team.createTeam(db(), idToken);

			return { id: idToken, teams: [team.id] };
		},
	);

	return oauth.authenticate(request);
}

export async function logout() {
	let subjectId = getSession().get("id");

	// unset just in case
	getSession().unset("id");
	getSession().unset("name");
	getSession().unset("email");
	getSession().unset("avatar");

	logger().info("action.logout.success", { subjectId });

	return redirect(href("/"), {
		headers: {
			"Set-Cookie": await measure("session.destroy", () => {
				return sessionStorage.destroySession(getSession());
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
