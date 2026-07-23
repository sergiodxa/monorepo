/**
 * React Router framework configuration for the books app. Enables split route
 * modules and dependency optimization so the app runs on the newest build
 * pipeline without carrying removed future flags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Config } from "@react-router/dev/config";

import "react-router";

export default {
	future: {
		unstable_optimizeDeps: true,
		v8_splitRouteModules: true,
	},
} satisfies Config;
