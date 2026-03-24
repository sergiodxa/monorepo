import middleware from "@pkg/remix-helpers/middleware";
import { createStorageKey, type RequestContext } from "remix/fetch-router";

import type * as schema from "~/schema";

import { db } from "~/middleware/db";
import { User } from "~/models/user";

declare module "remix/fetch-router" {
	interface RequestContext {
		auth: AuthState;
	}
}

let key = createStorageKey<AuthState>();

export default middleware(async (ctx, next) => {
	let state = await AuthState.create(ctx);
	ctx.storage.set(key, state);
	ctx.auth = state;

	return next();
});

export function authState(ctx: RequestContext) {
	let state = ctx.storage.get(key);
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
		this.#ctx.session.regenerateId();
		this.#ctx.session.set("userId", user.id);
		this.#user = user;
	}

	logout() {
		this.#ctx.session.destroy();
		this.#user = null;
	}

	setIdToken(idToken: string) {
		this.#ctx.session.set("idToken", idToken);
	}

	getIdToken() {
		let idToken = this.#ctx.session.get("idToken");
		if (typeof idToken !== "string") return null;
		return idToken;
	}
}

async function resolveCurrentUser(ctx: RequestContext) {
	let userId = ctx.session.get("userId");
	if (typeof userId !== "string" || !userId) return null;

	let user = await User.findById(db(ctx), userId);
	if (user) return user;

	ctx.session.unset("userId");
	ctx.session.unset("idToken");
	return null;
}
