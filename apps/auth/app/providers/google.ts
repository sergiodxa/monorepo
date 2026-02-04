import { env } from "cloudflare:workers";
import { parameterize } from "inflected";
import { href } from "react-router";
import { OAuth2Strategy } from "remix-auth-oauth2";

import type { Database } from "~/db/index";

import { Google } from "~/clients/google";
import * as schema from "~/db/schema";
import Connection from "~/models/connection";
import Customer from "~/models/customer";
import Subject from "~/models/subject";

export function google(db: Database, request: Request) {
	let url = new URL(request.url);

	let oauth = new OAuth2Strategy(
		{
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			redirectURI: new URL(href("/auth/:provider/callback", { provider: "google" }), url),
			authorizationEndpoint: new URL("https://accounts.google.com/o/oauth2/auth"),
			tokenEndpoint: new URL("https://oauth2.googleapis.com/token"),
			scopes: [
				"openid",
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			],
		},
		async ({ tokens }) => {
			let accessToken = tokens.accessToken();

			let user = await Google.user(accessToken);
			if (!user.email) throw new Error("Failed to access email from Google");

			let data = await Connection.find(db, "google", user.sub);
			if (data) return data.subjectId;

			let subject = await Subject.findByEmail(db, user.email);
			if (subject) {
				await Connection.create(db, "google", user.sub, subject.id);
				return subject.id;
			}

			let id = crypto.randomUUID();

			await Promise.all([
				Customer.assignOrCreateExternalIdByEmail(user.email, {
					id,
					emailAddress: user.email,
					displayName: user.name,
					username: parameterize(user.name),
				}),
				db.batch([
					db
						.insert(schema.subjects)
						.values({
							id,
							emailAddress: user.email,
							displayName: user.name,
							username: parameterize(user.name),
							avatar: user.picture,
						})
						.returning(),
					db
						.insert(schema.connections)
						.values({
							provider: "github",
							externalId: user.sub,
							subjectId: id,
						})
						.returning(),
				]),
			]);

			return id;
		},
	);

	return oauth.authenticate(request);
}
