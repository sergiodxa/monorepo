import action from "~/lib/action";

export default action<"GET", "/.well-known/openid-configuration">(() => {
	return new Response("OIDC Discovery");
});
