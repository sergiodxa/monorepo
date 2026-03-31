import middleware from "@pkg/remix-helpers/middleware";
import { getContext } from "remix/async-context-middleware";
import { createContextKey, type RequestContext } from "remix/fetch-router";
import { Session } from "remix/session";

import type * as schema from "~/schema";

import { db } from "~/middleware/db";
import { User } from "~/models/user";

let key = createContextKey<AuthState>();

export default middleware(async (ctx, next) => {
	let state = await AuthState.create(ctx);
	ctx.set(key, state);

	return next();
});

export function authState() {
	let ctx = getContext();
	let state = ctx.get(key);
	if (state) return state;
	throw new Error("Auth state not found in context. Make sure to use the auth-state middleware.");
}

export class AuthState {
	#ctx: RequestContext;
	#user: schema.SelectUser | null;

	private constructor(ctx: RequestContext, user: schema.SelectUser | null) {
		this.#ctx = ctx;
		this.#user = user;
	}

	static async create(ctx: RequestContext) {
		let user = await resolveCurrentUser(ctx);
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
		session.set("userId", user.id);
		this.#user = user;
	}

	logout() {
		let session = this.#ctx.get(Session);
		session.destroy();
		this.#user = null;
	}

	setIdToken(idToken: string) {
		let session = this.#ctx.get(Session);
		session.set("idToken", idToken);
	}

	getIdToken() {
		let session = this.#ctx.get(Session);
		let idToken = session.get("idToken");
		if (typeof idToken !== "string") return null;
		return idToken;
	}
}

async function resolveCurrentUser(ctx: RequestContext) {
	let session = ctx.get(Session);
	let userId = session.get("userId");
	if (typeof userId !== "string" || !userId) return null;

	let user = await User.findById(db(), userId);
	if (user) return user;

	session.unset("userId");
	session.unset("idToken");
	return null;
}
