/**
 * Session middleware and helpers for the app's request pipeline. Configures
 * `createSessionMiddleware` over the app's `sessionStorage` (auto-committing when id or email
 * changes), exposes a `getSession()` accessor from context storage, and a `requireSubject()`
 * guard that returns the session subject id or redirects to `/auth`. Exists to centralize
 * session access and authentication gating.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "react-router";
import { createSessionMiddleware } from "remix-utils/middleware/session";

import { sessionStorage } from "~/session";

import { getContext } from "./context-storage";

const [sessionMiddleware, getSessionFromContext] = createSessionMiddleware(
	sessionStorage,
	(prev, next) => {
		if (prev.id !== next.id) return true;
		if (prev.email !== next.email) return true;
		return false;
	},
);

export function getSession() {
	let context = getContext();
	return getSessionFromContext(context);
}

export function requireSubject() {
	let session = getSession();
	let id = session.get("id");
	if (id) return id;
	throw redirect("/auth");
}

export { sessionMiddleware };
