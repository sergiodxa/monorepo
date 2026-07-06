/**
 * Polar SDK client for the auth app. Instantiates a single Polar client
 * authenticated with the worker's access token, providing the shared handle the
 * customer model uses to sync subjects with Polar's billing/customer records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Polar } from "@polar-sh/sdk";
import { env } from "cloudflare:workers";
export default new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
