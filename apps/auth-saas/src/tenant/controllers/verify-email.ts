import action from "~/lib/action";

export default action<"GET", "/verify-email">({
	middleware: [],

	action() {
		return new Response("Verify email");
	},
});
