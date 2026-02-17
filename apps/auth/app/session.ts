import { createWorkersKVSessionStorage } from "@react-router/cloudflare";
import { env } from "cloudflare:workers";
import { createCookie } from "react-router";

interface SessionData {
	sub: string;
	sessionId: string; // The current database session ID
	authz: { clientId: string; state: string; redirectUri: string };
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
