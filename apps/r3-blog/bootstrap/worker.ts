export default {
	async fetch(request: Request) {
		let { router } = await import("./app");
		return await router.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
