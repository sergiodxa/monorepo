import form from "~/lib/form";

export default form<"/onboarding/finish">({
	middleware: [],

	actions: {
		index() {
			return new Response("Show finish onboarding form");
		},

		action() {
			return new Response("Complete onboarding");
		},
	},
});
