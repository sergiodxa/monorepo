import type { WithAuth } from "remix/auth-middleware";

import middleware from "@pkg/remix-helpers/middleware";
import { getContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { createContextKey, type MergeContext, type RequestContext } from "remix/fetch-router";
import { Session } from "remix/session";

import type * as schema from "~/schema";

export let AUTH_SESSION_USER_ID_KEY = "userId";
export let AUTH_SESSION_ID_TOKEN_KEY = "idToken";

export const authStateKey = createContextKey<AuthState>();

export type AuthStateContextTransform = readonly [readonly [typeof authStateKey, AuthState]];

export type WithAuthState<context extends RequestContext<any, any>> = MergeContext<
	context,
	AuthStateContextTransform
>;

export default middleware<"ANY", Record<string, any>, AuthStateContextTransform>((ctx, next) => {
	let state = AuthState.create(ctx);
	ctx.set(authStateKey, state);

	return next();
});

export function authState() {
	let ctx = getContext();
	let state = ctx.get(authStateKey);
	if (state) return state;
	throw new Error("Auth state not found in context. Make sure to use the auth-state middleware.");
}

export function readAuthState<context extends RequestContext<any, any>>(
	context: WithAuthState<context>,
) {
	return context.get(authStateKey);
}

export class AuthState {
	#ctx: RequestContext<any, any>;
	#user: schema.SelectUser | null;

	private constructor(ctx: RequestContext<any, any>, user: schema.SelectUser | null) {
		this.#ctx = ctx;
		this.#user = user;
	}

	static create(ctx: RequestContext<any, any>) {
		let user = resolveCurrentUser(ctx as WithAuth<RequestContext<any, any>, schema.SelectUser>);
		return new AuthState(ctx, user);
	}

	get user() {
		return this.#user;
	}

	get isAuthenticated() {
		return Boolean(this.#user);
	}

	get isAdmin() {
		return this.#user?.role === "admin";
	}

	login(user: schema.SelectUser) {
		let session = this.#ctx.get(Session);
		session.regenerateId();
		session.set(AUTH_SESSION_USER_ID_KEY, user.id);
		this.#user = user;
	}

	logout() {
		let session = this.#ctx.get(Session);
		session.destroy();
		this.#user = null;
	}

	setIdToken(idToken: string) {
		let session = this.#ctx.get(Session);
		session.set(AUTH_SESSION_ID_TOKEN_KEY, idToken);
	}

	getIdToken() {
		let session = this.#ctx.get(Session);
		let idToken = session.get(AUTH_SESSION_ID_TOKEN_KEY);
		if (typeof idToken !== "string") return null;
		return idToken;
	}
}

function resolveCurrentUser(ctx: WithAuth<RequestContext<any, any>, schema.SelectUser>) {
	let auth = ctx.get(Auth);
	if (!auth.ok) return null;
	return auth.identity;
}
