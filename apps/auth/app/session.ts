/**
 * Session storage for the auth app. Defines the typed session data (OAuth
 * tokens plus in-flight authorization request state) and a Cloudflare KV-backed
 * cookie session stored under an httpOnly, lax "sid" cookie scoped to the
 * sergiodxa.com domain in production, used to persist the user's login state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createWorkersKVSessionStorage } from "@react-router/cloudflare";
import { env } from "cloudflare:workers";
import { createCookie } from "react-router";

interface SessionData {
	accessToken: string;
	refreshToken: string;
	authz: {
		clientId: string;
		state: string;
		redirectUri: string;
		nonce?: string;
		scope?: string[];
		responseMode?: "query" | "fragment" | "form_post";
		prompt?: ("none" | "login" | "consent" | "select_account" | "create")[];
	};
}

const cookie = createCookie("sid", {
	path: "/",
	maxAge: 60 * 60 * 24 * 30, // 30 days
	httpOnly: true,
	sameSite: "lax",
	secure: import.meta.env.PROD,
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
	domain: import.meta.env.PROD ? ".sergiodxa.com" : undefined,
});

export const sessionStorage = createWorkersKVSessionStorage<SessionData>({
	kv: env.KV,
	cookie,
});
