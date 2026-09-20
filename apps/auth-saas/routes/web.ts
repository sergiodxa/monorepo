/**
 * The centralized, type-safe route table for the platform Worker. Declares every URL
 * so controllers, middleware, and views share a single source of truth for paths and
 * can build hrefs via `routes.*.href(...)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/**
 * The application route map. Each leaf is a typed route with `.href(params)` for
 * building URLs and is used as the key when mapping controllers in `bootstrap/app.ts`.
 *
 * @example
 * routes.index.href();
 */
export default route({
	index: get("/"),
	health: get("/health"),
});
