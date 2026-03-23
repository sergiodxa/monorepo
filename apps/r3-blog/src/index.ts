export default {
	async fetch(request) {
		let { router } = await import("./router");
		return router.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
