/**
 * The billing platform this server mirrors subjects into, constructed once per isolate:
 * the router middleware publishes this instance as `ctx.billing`, and anything running
 * outside a request imports it directly, so both bill against the same configuration.
 * Constructing it touches no network, which is what keeps it safe at module scope.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarBilling } from "@pkg/billing/providers/polar";
import { env } from "cloudflare:workers";

/**
 * Reads the Polar access token from the Secrets Store binding, falling back to the plain
 * `POLAR_ACCESS_TOKEN_LOCAL` variable so local development works against the store's empty
 * local simulation. Production configures the binding alone, so a failure there is real.
 *
 * @returns The Polar API access token.
 * @throws {Error} When the binding cannot be read and no local value is configured.
 */
export async function readPolarAccessToken(): Promise<string> {
	try {
		return await env.POLAR_ACCESS_TOKEN.get();
	} catch (error) {
		let local = env.POLAR_ACCESS_TOKEN_LOCAL;
		if (local) return local;
		throw error;
	}
}

/**
 * The Polar organization every subject is mirrored into. The token is handed over as a
 * resolver because it lives in Secrets Store and is only readable with an `await`, which
 * a module-scope constructor cannot do; the first call that bills pays for that read.
 *
 * Nothing is sold here, so no product is configured, and no delivery is received, so the
 * signing secret is empty — verification answers `false` rather than throwing for it.
 */
export const polar = new PolarBilling({
	accessToken: readPolarAccessToken,
	webhookSecret: "",
	products: {},
});
