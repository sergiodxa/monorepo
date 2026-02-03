import type { Config } from "@react-router/dev/config";

export default {
	future: {
		v8_middleware: true,
		unstable_optimizeDeps: true,
		v8_splitRouteModules: true,
		unstable_subResourceIntegrity: true,
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
