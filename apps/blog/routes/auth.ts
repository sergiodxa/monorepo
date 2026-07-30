/**
 * Route definitions for blog authentication. Declares the login and logout
 * form endpoints and the OAuth callback GET route, giving controllers typed URL
 * helpers for the sign-in flow against the external auth provider.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, route } from "remix/fetch-router/routes";

/**
 * Defines auth route helpers for login, logout, and OAuth callback endpoints.
 */
export default route({
	login: form("/login"),
	logout: form("/logout"),
	callback: get("/auth/callback"),
});
