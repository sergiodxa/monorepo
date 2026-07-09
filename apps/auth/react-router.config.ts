/**
 * React Router build configuration for the auth app. Enables subresource
 * integrity, split route modules, and dependency optimization. Middleware and
 * the Vite environment API graduated to always-on in this React Router
 * version, so they're no longer configured here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "@react-router/dev/config";

export default {
	splitRouteModules: true,
	subResourceIntegrity: true,
	future: {
		unstable_optimizeDeps: true,
	},
} satisfies Config;
