---
title: How to Link OAuth Accounts with Local User Profiles
excerpt: Handle new and existing users in your OAuth callback by linking external identities to local profiles.
tech: react-router@8.0.0 drizzle-orm@0.30.0
---

When implementing OAuth authentication, you need to handle two scenarios: new users signing up for the first time and existing users who already have a profile in your database. The challenge is linking the external OAuth identity (the subject ID from your [identity provider](/tutorials/build-an-oauth2-oidc-provider-from-scratch)) to your local user profile while keeping profile data in sync.

This becomes more complex when you have migrated users who existed before you added OAuth. These users have an email but no subject ID, so you need to link them by email on their first OAuth login.

## Create the User Schema

First, define your users table with both a local ID and a subject ID for the OAuth provider:

```ts {% path="app/db/schema.ts" %}
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	subjectId: text("subject_id").unique(),
	role: text("role", { enum: ["guest", "admin"] })
		.notNull()
		.default("guest"),
	email: text("email").notNull(),
	avatar: text("avatar"),
	username: text("username"),
	displayName: text("display_name"),
});
```

The `subjectId` is nullable because migrated users won't have one until they log in via OAuth. The `id` is your internal identifier, while `subjectId` links to the external identity provider.

## Handle the OAuth Callback

In your callback route, authenticate the request and verify the ID token:

```tsx {% path="app/routes/auth.callback.tsx" %}
import { eq, or } from "drizzle-orm";
import { data, href, redirect } from "react-router";
import { OAuth2RequestError } from "remix-auth-oauth2";

import { db } from "../db/client";
import { users } from "../db/schema";
import { verifyIdToken } from "../entities/id-token";
import { logger } from "../lib/logger";
import { getSession } from "../lib/session";
import { authenticate } from "../modules/auth";

import type { Route } from "./+types/auth.callback";

export async function loader({ request }: Route.LoaderArgs) {
	let session = getSession();
	if (session.has("user")) return redirect(href("/"));

	try {
		let tokens = await authenticate(request);
		let idToken = await verifyIdToken(tokens.idToken());

		// ... user lookup and creation logic
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
```

The loader first checks if the user is already logged in to avoid duplicate sessions. Then it authenticates the OAuth request and [verifies the ID token](/tutorials/validate-jwts-with-jwks) to extract user claims. Understanding the [difference between JWTs and opaque tokens](/articles/jwt-vs-opaque-tokens) helps you choose the right approach for your authentication flow.

## Find Existing Users by Subject ID or Email

Look up the user by both subject ID and email to handle migrated users:

```ts {% path="app/routes/auth.callback.tsx" %}
// Find user by subject ID or email (email fallback for migrated users without subject_id)
let [existingUser] = await db
	.select()
	.from(users)
	.where(or(eq(users.subjectId, idToken.subject), eq(users.email, idToken.email)))
	.limit(1);
```

This query finds users who either have the matching subject ID (returning users) or the matching email (migrated users logging in for the first time via OAuth).

## Create New User Profiles

If no existing user is found, create a new profile with data from the ID token:

```ts {% path="app/routes/auth.callback.tsx" %}
let user: NonNullable<typeof existingUser>;

if (!existingUser) {
	// Create new user profile with default guest role
	let [newUser] = await db
		.insert(users)
		.values({
			id: crypto.randomUUID(),
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
}
```

New users get a default role and their profile is populated from the [ID token claims](/articles/oauth2-tokens-explained). The `returning()` clause gives you the created record immediately.

## Link and Update Existing Users

For existing users, update their profile and link them to the OAuth subject:

```ts {% path="app/routes/auth.callback.tsx" %}
if (existingUser) {
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
```

This always updates the cached profile data (avatar, username, display name) from the identity provider. For migrated users, it also sets the `subjectId` for the first time, linking their local profile to their OAuth identity.

## Set the Session and Redirect

Finally, store the user data in the session and redirect:

```ts {% path="app/routes/auth.callback.tsx" %}
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

logger.info("auth.success", { userId: user.id, subjectId: idToken.subject });

return redirect(href("/"));
```

The session stores all the user data needed for authorization and display, avoiding extra database queries on subsequent requests.

## Render Error States

Add a component to display OAuth errors to the user:

```tsx {% path="app/routes/auth.callback.tsx" %}
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
```

The component only renders when there's an error (when `loaderData` contains the error response). On success, the redirect happens before the component renders.

## Final Thoughts

This pattern handles three user states gracefully: new users get created, returning users get their profile updated, and migrated users get linked to their OAuth identity. The key is using both subject ID and email in your lookup query, then always updating the subject ID on login to ensure the link is established.

Consider adding unique constraints on both `email` and `subjectId` columns to prevent duplicate accounts. You may also want to handle the edge case where a user tries to log in with an email that belongs to a different subject ID, which could indicate an account takeover attempt. For applications that need to [refresh tokens in the background](/articles/working-with-refresh-tokens-in-remix), you'll need to store the refresh token alongside the user profile.

For safer token handling in your callback, consider using [type-safe JWT wrapper classes](/tutorials/create-type-safe-jwt-wrapper-classes) to encapsulate the ID token structure.
