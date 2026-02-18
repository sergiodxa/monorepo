import { eq, or } from "drizzle-orm";
import { useTranslation } from "react-i18next";
import { data, href, redirect } from "react-router";
import { OAuth2RequestError } from "remix-auth-oauth2";

import { users } from "~/db/schema";
import { verifyIdToken } from "~/entities/id-token";
import { getDB } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { getSession } from "~/middleware/session";
import { authenticate } from "~/modules/auth";
import { generateUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
	let session = getSession();
	if (session.has("user")) return redirect(href("/"));

	try {
		let tokens = await authenticate(request);
		let idToken = await verifyIdToken(tokens.idToken());

		let db = getDB();

		// Find user by subject ID or email (email fallback for migrated users without subject_id)
		let [existingUser] = await db
			.select()
			.from(users)
			.where(or(eq(users.subjectId, idToken.subject), eq(users.email, idToken.email)))
			.limit(1);

		let user: NonNullable<typeof existingUser>;

		if (!existingUser) {
			// Create new user profile with default guest role
			let [newUser] = await db
				.insert(users)
				.values({
					id: generateUUID(),
					subjectId: idToken.subject,
					role: "guest",
					email: idToken.email,
					avatar: idToken.picture,
					username: idToken.username,
					displayName: idToken.name,
				})
				.returning();

			if (!newUser) throw new Error("Failed to create user");
			user = newUser;
			logger.info("user.created", { subjectId: idToken.subject, userId: user.id });
		} else {
			// Update user with subject_id (for migrated users) and cached profile data from ID token
			let [updatedUser] = await db
				.update(users)
				.set({
					subjectId: idToken.subject, // Link existing user to auth subject
					email: idToken.email,
					avatar: idToken.picture,
					username: idToken.username,
					displayName: idToken.name,
				})
				.where(eq(users.id, existingUser.id))
				.returning();

			if (!updatedUser) throw new Error("Failed to update user");
			user = updatedUser;

			// Log if we just linked an existing user to their auth subject
			if (!existingUser.subjectId) {
				logger.info("user.linked", { subjectId: idToken.subject, userId: user.id });
			}
		}

		// Set session with user data
		session.set("user", {
			id: user.id,
			subjectId: user.subjectId!,
			role: user.role,
			email: user.email,
			avatar: user.avatar,
			username: user.username,
			displayName: user.displayName,
		});

		// Store ID token for SSO logout
		session.set("idToken", tokens.idToken());

		logger.info("auth.success", { userId: user.id, subjectId: idToken.subject });

		return redirect(href("/"));
	} catch (error) {
		if (error instanceof OAuth2RequestError) {
			logger.error("auth.oauth_error", {
				code: error.code,
				description: error.description,
			});
			return data({ code: error.code, description: error.description }, { status: 400 });
		}
		throw error;
	}
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "login.error" });

	if (!loaderData) return null;

	return (
		<main className="mx-auto flex max-w-screen-sm flex-col items-center gap-4 pt-10">
			<h1 className="text-2xl font-bold">{t("title")}</h1>
			<p>{t("description", { code: loaderData.code })}</p>
		</main>
	);
}
