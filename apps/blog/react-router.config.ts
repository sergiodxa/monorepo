/**
 * React Router build-time configuration for the blog app. Enables a set of v8
 * build-time options so the app opts into newer behavior ahead of the stable
 * release without carrying removed future flags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "@react-router/dev/config";

export default {
	splitRouteModules: true,
	future: {
		unstable_optimizeDeps: true,
	},
} satisfies Config;
