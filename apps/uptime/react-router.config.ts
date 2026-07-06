/**
 * React Router build configuration for the uptime app. Enables Subresource
 * Integrity and opts every app-relevant future flag (v8 middleware, split route
 * modules, the Vite environment API, and more) into their unstable/preview forms.
 * It exists to pin the framework's behaviour so the app builds against the newest
 * React Router capabilities it relies on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
