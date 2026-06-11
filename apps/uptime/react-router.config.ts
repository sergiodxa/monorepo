import type { Config } from "@react-router/dev/config";

export default {
	subResourceIntegrity: true,
	future: {
		unstable_optimizeDeps: true,
		unstable_previewServerPrerendering: true,
		v8_middleware: true,
		v8_passThroughRequests: true,
		v8_splitRouteModules: true,
		v8_trailingSlashAwareDataRequests: true,
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
