/**
 * Cookie-based session handling: a signed cookie carries the session id while
 * the values live in KV for a year, so login state survives across requests and
 * across isolates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Middleware } from "remix/router";

import { text } from "@sdxc/http/response";
import { currentLog } from "@sdxc/logger";
import { isFailure, wrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createCookie } from "remix/cookie";
import * as s from "remix/data-schema";
import { minLength } from "remix/data-schema/checks";
import { session } from "remix/middleware/session";

import { getEnv } from "~/app/http/middleware/env";
import { KVSessionStorage } from "~/app/infrastructure/session/kv-session-storage-adapter";

/**
 * Session payload types for cookie-backed sessions.
 */
export namespace SessionMiddleware {
	/**
	 * Values kept for the lifetime of a signed-in session.
	 */
	export interface Values extends Record<string, unknown> {
		userId?: string;
	}
}

const SESSION_COOKIE_NAME = "r3:session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;
const SESSION_PREFIX = "session:";

/** A key the session cookie can be signed with: any string with at least one character. */
const SESSION_SECRET = s.string().pipe(minLength(1));

/** Recorded when a request arrives with no usable `COOKIE_SESSION_SECRET`. */
const SECRET_MISSING_EVENT = "session.secret_missing";

let cachedSessionMiddleware: {
	secret: string;
	middleware: ReturnType<typeof createSessionMiddleware>;
} | null = null;

/**
 * Attaches session handling to every request, signing the cookie with
 * `COOKIE_SESSION_SECRET`. A request arriving without that secret is answered with a
 * 500, so no cookie is ever signed or trusted under a key anyone could know. The
 * middleware is rebuilt whenever the secret changes and reused while it holds.
 */
let sessionMiddleware: Middleware = async (ctx, next) => {
	let secret = await readSecret();

	if (isFailure(secret)) {
		currentLog()?.warn(SECRET_MISSING_EVENT, { error: secret.error.message });
		return text("Internal Server Error", { status: 500 });
	}

	let cached = cachedSessionMiddleware;

	if (cached?.secret !== secret.data) {
		cached = { secret: secret.data, middleware: createSessionMiddleware(secret.data) };
		cachedSessionMiddleware = cached;
	}

	return cached.middleware(ctx, next);
};

export default sessionMiddleware;

/**
 * Reads the cookie signing secret from the request's bindings.
 *
 * @returns The secret, or why the bindings hold no usable one: unset or empty.
 */
async function readSecret(): Promise<Result<string, Error>> {
	let secret = wrap(() => getEnv("COOKIE_SESSION_SECRET"));
	if (isFailure(secret)) return secret;
	return validate(secret.data, SESSION_SECRET);
}

function createSessionMiddleware(secret: string) {
	let sessionCookie = createCookie(SESSION_COOKIE_NAME, {
		path: "/",
		maxAge: SESSION_TTL_SECONDS,
		httpOnly: true,
		sameSite: "Lax",
		secure: getEnv("IS_PROD"),
		secrets: [secret],
	});

	return session(
		sessionCookie,
		new KVSessionStorage<SessionMiddleware.Values>(getEnv("AUTH"), {
			ttlSeconds: SESSION_TTL_SECONDS,
			prefix: SESSION_PREFIX,
		}),
	);
}
