/**
 * The centralized, type-safe route table for the management API, served on
 * `api.{PLATFORM_DOMAIN}`. This pass adds only the token endpoint every later
 * resource-area pass authenticates through; each of those passes extends this
 * same table with its own routes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { post, route } from "remix/routes";

/**
 * The management API's route map.
 *
 * @example
 * routes.token.href();
 */
export default route({
	token: post("/oauth/token"),
});
