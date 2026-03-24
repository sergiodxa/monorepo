import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";
import { session } from "remix/session-middleware";

import { KVSessionStorage } from "~/lib/session-storage-kv-adapter";

export namespace SessionMiddleware {
	export interface Values extends Record<string, unknown> {
		userId?: string;
		idToken?: string;
	}
}

const SESSION_COOKIE_NAME = "r3:session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
const SESSION_PREFIX = "session:";

let sessionCookie = createCookie(SESSION_COOKIE_NAME, {
	path: "/",
	maxAge: SESSION_TTL_SECONDS,
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
});

export default session(
	sessionCookie,
	new KVSessionStorage<SessionMiddleware.Values>(env.AUTH, {
		ttlSeconds: SESSION_TTL_SECONDS,
		prefix: SESSION_PREFIX,
	}),
);
