/**
 * Configured Resend client singleton for the app. Instantiates a `Resend` instance with the
 * `RESEND_API_TOKEN` from the Cloudflare Workers environment and exports it as the default.
 * Exists so transactional email code shares one preconfigured client instead of wiring up
 * the API token at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { Resend } from "resend";
export default new Resend(env.RESEND_API_TOKEN);
