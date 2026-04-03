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

export default middleware((ctx, next) => {
	let sessionCookie = createCookie(SESSION_COOKIE_NAME, {
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure: getEnv("IS_PROD"),
		secrets: [getEnv("COOKIE_SESSION_SECRET", "s3cr3t")],
	});

	let sessionMiddleware = session(
		sessionCookie,
		new KVSessionStorage<SessionMiddleware.Values>(getEnv("AUTH"), {
			ttlSeconds: SESSION_TTL_SECONDS,
			prefix: SESSION_PREFIX,
		}),
	);

	return sessionMiddleware(ctx, next);
});
