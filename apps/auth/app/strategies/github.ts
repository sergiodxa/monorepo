import { env } from "cloudflare:workers";
import { href } from "react-router";
import { OAuth2Strategy } from "remix-auth-oauth2";

import type { Database } from "~/db/index";

import { GitHub } from "~/clients/github";
import * as schema from "~/db/schema";
import { logger } from "~/middleware/logger";
import Connection from "~/models/connection";
import Customer from "~/models/customer";

export function github(db: Database, request: Request) {
	let url = new URL(request.url);

	let oauth = new OAuth2Strategy(
		{
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET,
			redirectURI: new URL(href("/auth/:provider/callback", { provider: "github" }), url),
			authorizationEndpoint: new URL("https://github.com/login/oauth/authorize"),
			tokenEndpoint: new URL("https://github.com/login/oauth/access_token"),
			scopes: ["read:user", "user:email"],
		},
		async ({ tokens }) => {
			let accessToken = tokens.accessToken();
			logger.info("github_oauth_tokens_received");

			let user = await GitHub.user(accessToken);
			logger.info("github_user_fetched", { login: user.login });

			if (!user.email) {
				logger.error("github_email_missing", { login: user.login });
				throw new Error("Failed to access email from GitHub");
			}

			let data = await Connection.find(db, "github", user.node_id);
			if (data) {
				logger.info("github_connection_found", { subjectId: data.subjectId });
				return data.subjectId;
			}

			let id = crypto.randomUUID();

			await Promise.all([
				Customer.assignOrCreateExternalIdByEmail(user.email, {
					id,
					emailAddress: user.email,
					displayName: user.name ?? user.login,
					username: user.login,
				}),
				db.batch([
					db
						.insert(schema.subjects)
						.values({
							id,
							emailAddress: user.email,
							displayName: user.name ?? user.login,
							username: user.login,
							avatar: user.avatar_url,
							emailVerifiedAt: new Date(),
						})
						.returning(),
					db
						.insert(schema.connections)
						.values({
							provider: "github",
							externalId: user.node_id,
							subjectId: id,
						})
						.returning(),
				]),
			]);

			logger.info("github_subject_created", { subjectId: id, email: user.email });
			return id;
		},
	);

	return oauth.authenticate(request);
}
