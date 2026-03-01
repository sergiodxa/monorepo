import action from "~/lib/action";

export default action<"POST", "/oauth/revoke">(() => {
	return new Response("OAuth Revoke");
});
