import type { Config } from "@react-router/dev/config";
import "react-router";

export default {
	future: {
		v8_middleware: true,
		unstable_optimizeDeps: true,
		v8_splitRouteModules: true,
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
