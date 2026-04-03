import { form, get, route } from "remix/fetch-router/routes";

export default route({
	login: form("/login"),
	logout: form("/logout"),
	callback: get("/auth/callback"),
});
