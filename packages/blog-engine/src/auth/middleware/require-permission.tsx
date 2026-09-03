/**
 * Route middleware factory ({@link requirePermission}) that gates a controller on a
 * set of permissions: anonymous users are redirected to login, and authenticated but
 * unauthorized users get a 403 "no access" page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle } from "remix/ui";

import { redirect } from "@sdxc/http/response";
import { css } from "remix/ui";

import type { Permission } from "../../shared/permissions.js";

import routes from "../../routes.js";
import middleware from "../../shared/lib/middleware.js";
import { hasAll } from "../../shared/permissions.js";

import { getAuthUser, getPermissions } from "./auth.js";

function NoAccessPage(_handle: Handle<Record<string, never>>) {
	return () => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>No access</title>
			</head>
			<body
				mix={[
					css({
						fontFamily: "system-ui, sans-serif",
						maxWidth: "32rem",
						margin: "4rem auto",
						padding: "0 1rem",
					}),
				]}
			>
				<h1>No access</h1>
				<p>
					Your account doesn't have permission to use this area. Ask an administrator for a role.
				</p>
			</body>
		</html>
	);
}

/**
 * Route middleware that requires the current user to hold every given permission.
 * Anonymous requests redirect to login; authenticated-but-unauthorized requests get
 * a 403 "no access" page rendered with `remix/ui`.
 * @param keys - Permissions the user must all hold.
 * @returns A middleware enforcing the requirement.
 */
export function requirePermission(...keys: Permission[]) {
	return middleware(async (context, next) => {
		let user = getAuthUser();
		if (!user) {
			let returnTo = new URL(context.request.url).pathname;
			let location = `${routes.auth.login.index.href()}?next=${encodeURIComponent(returnTo)}`;
			return redirect(location, { status: redirect.Status.SeeOther });
		}
		let permissions = await getPermissions();
		if (!hasAll(permissions, keys)) return context.render(<NoAccessPage />, { status: 403 });
		return next();
	});
}
