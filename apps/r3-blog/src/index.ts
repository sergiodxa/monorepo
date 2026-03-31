export default {
	async fetch(request) {
		let { router } = await import("./router");
		return await router.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
