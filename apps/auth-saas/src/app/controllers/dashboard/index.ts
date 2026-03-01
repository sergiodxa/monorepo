import action from "~/lib/action";

export default action<"GET", "/dashboard">(() => {
	return new Response("Show dashboard");
});
