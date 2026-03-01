import action from "~/lib/action";

export default action<"GET", "/.well-known/jwks.json">(() => {
	return new Response("JWKS");
});
