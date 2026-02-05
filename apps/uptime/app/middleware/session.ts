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
