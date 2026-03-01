import form from "~/lib/form";

export default form<"/onboarding/region">({
	middleware: [],

	actions: {
		index() {
			return new Response("Show region selection form");
		},

		action() {
			return new Response("Submit region selection");
		},
	},
});
