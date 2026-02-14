import { href, redirect } from "react-router";

import { logger } from "~/middleware/logger";

export function loader() {
	logger().info("docs.index.redirect", { to: "/docs/overview" });
	throw redirect(href("/docs/*", { "*": "overview" }));
}
