/**
 * Route manifest for the blog app. Delegates the entire route tree to React
 * Router's file-system routing convention via flatRoutes, so routes are derived
 * from the files under app/routes rather than declared by hand here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RouteConfig } from "@react-router/dev/routes";

import { flatRoutes } from "@react-router/fs-routes";

export default flatRoutes() satisfies RouteConfig;
