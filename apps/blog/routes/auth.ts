/**
 * Route definitions for blog authentication: the login and logout form
 * endpoints and the OAuth callback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, route } from "remix/routes";

/**
 * Typed URL and method helpers for the sign-in flow against the external auth
 * provider.
 */
export default route({
	login: form("/login"),
	logout: form("/logout"),
	callback: get("/auth/callback"),
});
