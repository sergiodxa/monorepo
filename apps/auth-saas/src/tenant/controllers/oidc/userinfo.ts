import action from "~/lib/action";

export default action<"GET", "/userinfo">(() => {
	return new Response("OIDC userinfo");
});
