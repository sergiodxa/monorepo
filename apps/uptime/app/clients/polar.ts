/**
 * Configured Polar billing client singleton for the app. Instantiates a `Polar` instance
 * with the `POLAR_ACCESS_TOKEN` from the Cloudflare Workers environment and exports it as the
 * default. Exists so subscription and payment code shares one preconfigured client instead
 * of wiring up the access token at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Polar } from "@polar-sh/sdk";
import { env } from "cloudflare:workers";
export default new Polar({ accessToken: env.POLAR_ACCESS_TOKEN });
