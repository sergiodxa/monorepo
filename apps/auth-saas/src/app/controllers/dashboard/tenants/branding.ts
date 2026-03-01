import form from "~/lib/form";

export default form<"/dashboard/tenants/:tenantId/branding">({
	middleware: [],

	actions: {
		index({ params }) {
			return new Response(`Show branding form for tenant ${params.tenantId}`);
		},

		action({ params }) {
			return new Response(`Update branding for tenant ${params.tenantId}`);
		},
	},
});
