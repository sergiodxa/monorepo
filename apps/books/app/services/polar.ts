/**
 * Polar SDK service that instantiates a single Polar client from the required
 * POLAR_ACCESS_TOKEN environment variable, providing the shared entry point for all
 * product, checkout, discount, customer, and order calls made by the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Polar } from "@polar-sh/sdk";
import { env } from "cloudflare:workers";

if (!env.POLAR_ACCESS_TOKEN) {
	throw new Error("POLAR_ACCESS_TOKEN is required");
}

export default new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
