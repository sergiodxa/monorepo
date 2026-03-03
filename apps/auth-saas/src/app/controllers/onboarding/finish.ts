import form from "~/lib/form";

/**
 * Final step in onboarding flow.
 * TODO: Implement finish UI when additional onboarding steps are needed.
 * Currently redirects to dashboard since onboarding is complete after auth.
 */
export default form<"/onboarding/finish">({
	middleware: [],

	actions: {
		index() {
			// Onboarding is complete after auth, redirect to dashboard
			return new Response(null, {
				status: 302,
				headers: { Location: "/dashboard" },
			});
		},

		action() {
			// Onboarding is complete after auth, redirect to dashboard
			return new Response(null, {
				status: 302,
				headers: { Location: "/dashboard" },
			});
		},
	},
});
