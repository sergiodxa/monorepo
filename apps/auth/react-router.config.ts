/**
 * React Router build configuration for the auth app. Enables the framework's
 * unstable/v8 future flags — dependency optimization, subresource integrity,
 * the v8 middleware API, split route modules, and the Vite environment API —
 * so the app opts into the next-generation runtime behavior.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "@react-router/dev/config";

export default {
	future: {
		unstable_optimizeDeps: true,
		unstable_subResourceIntegrity: true,
		v8_middleware: true,
		v8_splitRouteModules: true,
		v8_viteEnvironmentApi: true,
	},
} satisfies Config;
