/**
 * React Router framework configuration for the books app, enabling the v8 future
 * flags (middleware, split route modules, Vite environment API) and dependency
 * optimization so the app runs on React Router's newest build pipeline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
