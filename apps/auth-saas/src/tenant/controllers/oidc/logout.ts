import action from "~/lib/action";

export default action<"GET", "/oidc/logout">(() => {
	return new Response("OIDC logout");
});
