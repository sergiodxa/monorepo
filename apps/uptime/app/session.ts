/**
 * Session storage for the uptime app. Defines the `SessionData` shape (user id,
 * name, email, avatar, and OIDC id token) and creates a Cloudflare KV-backed
 * session store keyed by a `session:` prefix using the session cookie. It exists
 * to persist authenticated user state across requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { createWorkersKVSessionStorage } from "~/vendor/create-worker-kv-session-storage";

import { session as cookie } from "./cookies";

export interface SessionData {
	id: string;
	name: string;
	email: string;
	avatar: string;
	idToken: string;
}

export const sessionStorage = createWorkersKVSessionStorage<SessionData>({
	kv: env.KV,
	cookie,
	prefix: "session:",
});
