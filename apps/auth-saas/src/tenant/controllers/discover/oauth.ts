import action from "~/lib/action";

export default action<"GET", "/.well-known/oauth-authorization-server">(() => {
	return new Response("OAuth Discovery");
});
