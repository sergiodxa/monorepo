import { redirect } from "@pkg/http/response";
import { forbidden } from "@pkg/http/response/html";

import type { Permission } from "../../shared/permissions";

import routes from "../../routes";
import middleware from "../../shared/lib/middleware";
import { hasAll } from "../../shared/permissions";

import { getAuthUser, getPermissions } from "./auth";

/** Minimal "no access" page for authenticated users lacking a permission. */
function noAccessPage(): Response {
	return forbidden(
		`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>No access</title></head>` +
			`<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
			`<h1>No access</h1><p>Your account doesn't have permission to use this area. ` +
			`Ask an administrator for a role.</p></body></html>`,
	);
}

/**
 * Route middleware that requires the current user to hold every given permission.
 * Anonymous requests redirect to login; authenticated-but-unauthorized requests
 * get a 403 "no access" page.
 * @param keys - Permissions the user must all hold.
 * @returns A middleware enforcing the requirement.
 */
export function requirePermission(...keys: Permission[]) {
	return middleware(async (context, next) => {
		let user = await getAuthUser();
		if (!user) {
			let returnTo = new URL(context.request.url).pathname;
			let location = `${routes.auth.login.index.href()}?next=${encodeURIComponent(returnTo)}`;
			return redirect(location, { status: redirect.Status.SeeOther });
		}
		let permissions = await getPermissions();
		if (!hasAll(permissions, keys)) return noAccessPage();
		return next();
	});
}

/**
 * Route middleware that only requires authentication (used by the CMS shell where
 * per-action permission checks happen inside controllers).
 * @returns A middleware requiring a signed-in user.
 */
export function requireAuth() {
	return middleware(async (context, next) => {
		let user = await getAuthUser();
		if (!user) {
			let returnTo = new URL(context.request.url).pathname;
			let location = `${routes.auth.login.index.href()}?next=${encodeURIComponent(returnTo)}`;
			return redirect(location, { status: redirect.Status.SeeOther });
		}
		return next();
	});
}
