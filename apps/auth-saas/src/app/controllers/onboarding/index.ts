import form from "~/lib/form";

export default form<"/onboarding">({
	middleware: [],

	actions: {
		index() {
			return new Response("Show onboarding form");
		},

		action() {
			return new Response("Submit onboarding");
		},
	},
});
