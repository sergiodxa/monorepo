import action from "~/lib/action";

export default action<"POST", "/oauth/token">(() => {
	return new Response("OAuth Token");
});
