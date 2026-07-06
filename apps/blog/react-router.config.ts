/**
 * React Router build-time configuration for the blog app. Enables a set of v8
 * future flags (middleware, split route modules, the Vite environment API,
 * dependency optimization, and trailing-slash-aware data requests) so the app
 * opts into the framework's newer behavior ahead of the stable release.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "@react-router/dev/config";

export default {
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
