/**
 * Route configuration entry point that builds the app's route tree from the
 * filesystem using flat-routes conventions, so route modules under app/routes
 * are automatically registered without a hand-maintained route manifest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RouteConfig } from "@react-router/dev/routes";

import { flatRoutes } from "@react-router/fs-routes";

export default flatRoutes() satisfies RouteConfig;
