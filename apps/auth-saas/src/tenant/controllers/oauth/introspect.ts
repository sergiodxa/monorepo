import action from "~/lib/action";

export default action<"POST", "/oauth/introspect">(() => {
	return new Response("OAuth Introspect");
});
