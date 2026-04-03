import { form, get, route } from "remix/fetch-router/routes";

/**
 * Defines auth route helpers for login, logout, and OAuth callback endpoints.
 */
export default route({
	login: form("/login"),
	logout: form("/logout"),
	callback: get("/auth/callback"),
});
