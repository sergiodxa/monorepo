/**
 * React Router build configuration for the uptime app. Enables Subresource
 * Integrity and opts into route module splitting. Middleware, the Vite
 * environment API, pass-through requests, trailing-slash-aware data requests,
 * and server prerendering via the Vite environment API are all always-on in
 * this version of React Router, so they no longer need (or accept) future
 * flags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "@react-router/dev/config";

export default {
	subResourceIntegrity: true,
	splitRouteModules: true,
	future: {
		unstable_optimizeDeps: true,
	},
} satisfies Config;
