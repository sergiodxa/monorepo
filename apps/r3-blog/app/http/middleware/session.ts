import middleware from "@pkg/remix-helpers/middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/session-middleware";

import { getEnv } from "~/app/http/middleware/env";
import { KVSessionStorage } from "~/app/infrastructure/session/kv-session-storage-adapter";

export namespace SessionMiddleware {
	export interface Values extends Record<string, unknown> {
		userId?: string;
		idToken?: string;
	}
}

const SESSION_COOKIE_NAME = "r3:session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
const SESSION_PREFIX = "session:";

let cachedSessionMiddleware: ReturnType<typeof createSessionMiddleware> | null = null;

export default middleware((ctx, next) => {
	let sessionMiddleware = cachedSessionMiddleware;

	if (!sessionMiddleware) {
		sessionMiddleware = createSessionMiddleware();
		cachedSessionMiddleware = sessionMiddleware;
	}

	return sessionMiddleware(ctx, next);
});

function createSessionMiddleware() {
	let sessionCookie = createCookie(SESSION_COOKIE_NAME, {
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure: getEnv("IS_PROD"),
		secrets: [getEnv("COOKIE_SESSION_SECRET", "s3cr3t")],
	});

	return session(
		sessionCookie,
		new KVSessionStorage<SessionMiddleware.Values>(getEnv("AUTH"), {
			ttlSeconds: SESSION_TTL_SECONDS,
			prefix: SESSION_PREFIX,
		}),
	);
}
