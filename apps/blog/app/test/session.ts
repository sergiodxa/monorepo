/**
 * Workers-pool test support: an admin account, and a session signed in as an account
 * written to the real `AUTH` binding the way a completed login leaves it, so a test
 * drives the router as that person's browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { randomToken } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:test";
import { createCookie } from "remix/cookie";

import { bindModels } from "~/app/test/models";

/** The session cookie's name, as the session middleware sets it. */
const SESSION_COOKIE_NAME = "r3:session";

/** The KV key prefix the session middleware stores session data under. */
const SESSION_PREFIX = "session:";

/** Lifetime of the stored token set and the cookie, longer than any test runs. */
const LIFETIME_SECONDS = 60 * 60;

/**
 * Creates an account holding the admin role, the one the CMS guards let through.
 *
 * @param db The migrated database.
 * @returns The new admin's id.
 */
export function seedAdmin(db: Database): Promise<string> {
	return seedUser(db, "admin");
}

/**
 * Creates an account holding `role`; `guest` is the role every login starts with.
 *
 * @param db The migrated database.
 * @param role The role the account holds.
 * @returns The new account's id.
 */
export async function seedUser(db: Database, role: "admin" | "guest"): Promise<string> {
	let suffix = generateUUID().slice(0, 8);
	let user = unwrap(
		await bindModels(db).users.create({
			subject_id: generateUUID(),
			role,
			email: `${role}-${suffix}@example.com`,
			avatar: "https://example.com/avatar.png",
			username: `${role}-${suffix}`,
			display_name: role === "admin" ? "Admin" : "Guest",
		}),
	);
	return user.id;
}

/**
 * Stores a session signed in as `userId` and returns the `Cookie` header naming it. The
 * token set is opaque with a future expiry, so the auth middleware resolves the account
 * without contacting the provider; the cookie carries the signed expiry envelope the
 *
 * @param userId The account the session is signed in as.
 * @param secret The key the cookie is signed with, which the app accepts only when it holds the same one.
 * @returns The `name=value` pair a browser would send back.
 */
export async function signedInCookie(userId: string, secret: string): Promise<string> {
	let id = randomToken();
	let tokens = {
		idToken: "id-token",
		accessToken: "access-token",
		refreshToken: null,
		expiresAt: Math.floor(Date.now() / 1000) + LIFETIME_SECONDS,
	};
	await env.AUTH.put(`${SESSION_PREFIX}${id}`, JSON.stringify([{ userId, auth: tokens }, {}]));

	let envelope = JSON.stringify({ value: id, expires: Date.now() + LIFETIME_SECONDS * 1000 });
	let header = await createCookie(SESSION_COOKIE_NAME, { secrets: [secret] }).serialize(envelope);
	return header.split(";")[0] ?? "";
}
