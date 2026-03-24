import middleware from "@pkg/remix-helpers/middleware";
import { env } from "cloudflare:workers";
import { createCookie } from "remix/cookie";
import { createSession, type Session, type SessionStorage } from "remix/session";
import { session } from "remix/session-middleware";

import type * as schema from "~/schema";

export namespace SessionMiddleware {
	export type SessionValues = Record<string, unknown> & {
		user?: schema.SelectUser;
		idToken?: string;
	};

	export interface AuthState {
		isAuthenticated: boolean;
		isAdmin: boolean;
		user: schema.SelectUser | null;
	}
}

declare module "remix/fetch-router" {
	interface RequestContext {
		auth: SessionMiddleware.AuthState;
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

let sessionStorage: SessionStorage = {
	async read(cookie) {
		if (!cookie) return createSession();

		let raw = await env.AUTH.get(kvKey(cookie));
		if (!raw) return createSession(cookie);

		let parsed = parseStoredSessionData(raw);
		if (!parsed) return createSession(cookie);

		return createSession(cookie, parsed);
	},

	async save(currentSession) {
		if (currentSession.deleteId) {
			await env.AUTH.delete(kvKey(currentSession.deleteId));
		}

		if (currentSession.destroyed) {
			await env.AUTH.delete(kvKey(currentSession.id));
			return "";
		}

		if (currentSession.dirty) {
			await env.AUTH.put(kvKey(currentSession.id), JSON.stringify(currentSession.data), {
				expirationTtl: SESSION_TTL_SECONDS,
			});
			return currentSession.id;
		}

		return null;
	},
};

export const sessionMiddleware = session(sessionCookie, sessionStorage);

export const authStateMiddleware = middleware((ctx, next) => {
	let user = getUser(ctx);
	ctx.auth = {
		isAuthenticated: Boolean(user),
		isAdmin: user?.role === "admin",
		user,
	};

	return next();
});

export function getUser(ctx: { session: Session }) {
	let user = ctx.session.get("user");
	if (!user || typeof user !== "object") return null;
	return user as schema.SelectUser;
}

export function setUser(
	ctx: { session: Session; auth: SessionMiddleware.AuthState },
	user: schema.SelectUser,
) {
	ctx.session.regenerateId();
	ctx.session.set("user", user);
	ctx.auth = {
		isAuthenticated: true,
		isAdmin: user.role === "admin",
		user,
	};
}

export function clearUser(ctx: { session: Session; auth: SessionMiddleware.AuthState }) {
	ctx.session.unset("user");
	ctx.session.unset("idToken");
	ctx.auth = {
		isAuthenticated: false,
		isAdmin: false,
		user: null,
	};
}

export function setIdToken(ctx: { session: Session }, idToken: string) {
	ctx.session.set("idToken", idToken);
}

export function getIdToken(ctx: { session: Session }) {
	let idToken = ctx.session.get("idToken");
	if (typeof idToken !== "string") return null;
	return idToken;
}

export function destroySession(ctx: { session: Session; auth: SessionMiddleware.AuthState }) {
	ctx.session.destroy();
	ctx.auth = {
		isAuthenticated: false,
		isAdmin: false,
		user: null,
	};
}

function parseStoredSessionData(
	raw: string,
): [SessionMiddleware.SessionValues, Record<string, unknown>] | null {
	try {
		let parsed = JSON.parse(raw) as unknown;

		if (Array.isArray(parsed) && parsed.length === 2) {
			return parsed as [SessionMiddleware.SessionValues, Record<string, unknown>];
		}

		if (isObject(parsed) && Array.isArray(parsed.data) && parsed.data.length === 2) {
			return parsed.data as [SessionMiddleware.SessionValues, Record<string, unknown>];
		}

		if (isObject(parsed)) {
			let values: SessionMiddleware.SessionValues = {};

			if (isObject(parsed.user)) {
				values.user = parsed.user as schema.SelectUser;
			}

			if (typeof parsed.idToken === "string") {
				values.idToken = parsed.idToken;
			}

			return [values, {}];
		}

		return null;
	} catch {
		return null;
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function kvKey(sessionId: string) {
	return `${SESSION_PREFIX}${sessionId}`;
}
