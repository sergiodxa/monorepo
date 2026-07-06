/**
 * Configured authentication client singleton for the app. Instantiates the shared `AuthSDK`
 * with the OAuth `CLIENT_ID` and `CLIENT_SECRET` from the Cloudflare Workers environment and
 * exports it as the default. Exists so sign-in and identity code reuses one preconfigured
 * client instead of passing credentials at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSDK } from "@pkg/auth-sdk";
import { env } from "cloudflare:workers";

export default new AuthSDK({
	client: { id: env.CLIENT_ID, secret: env.CLIENT_SECRET },
});
