/**
 * Index route for the /docs section. It has no UI of its own; its loader simply
 * logs the redirect and sends visitors to the /docs/overview page so the docs
 * landing URL always resolves to a concrete starting document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { href, redirect } from "react-router";

import { logger } from "~/middleware/logger";

export function loader() {
	logger().info("docs.index.redirect", { to: "/docs/overview" });
	throw redirect(href("/docs/*", { "*": "overview" }));
}
