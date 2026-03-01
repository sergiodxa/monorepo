import form from "~/lib/form";

export default form<"/dashboard/tenants/:tenantId/hostname">({
	middleware: [],

	actions: {
		index({ params }) {
			return new Response(`Show hostname form for tenant ${params.tenantId}`);
		},

		action({ params }) {
			return new Response(`Update hostname for tenant ${params.tenantId}`);
		},
	},
});
