import form from "~/lib/form";

/**
 * Region selection step in onboarding flow.
 * TODO: Implement region selection UI when multi-region support is needed.
 * Currently redirects to dashboard since region is auto-selected.
 */
export default form<"/onboarding/region">({
	middleware: [],

	actions: {
		index() {
			// Region is currently auto-selected, redirect to dashboard
			return new Response(null, {
				status: 302,
				headers: { Location: "/dashboard" },
			});
		},

		action() {
			// Region is currently auto-selected, redirect to dashboard
			return new Response(null, {
				status: 302,
				headers: { Location: "/dashboard" },
			});
		},
	},
});
