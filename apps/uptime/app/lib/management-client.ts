/**
 * The client that reads other people's profiles from the identity provider, for the
 * surfaces that need more than the signed-in viewer's own claims. It authenticates as
 * this app itself, so the two jobs with no request behind them reach it too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ManagementClient } from "@sdxc/auth/management-client";
import { ServiceClient } from "@sdxc/auth/service-client";
import { env } from "cloudflare:workers";

import { issuer } from "~/app/auth/issuer";

/** The isolate's client, built by whichever unit of work reads a profile first. */
let instance: ManagementClient | undefined;

/**
 * Opens the client that reads subject profiles from the identity provider.
 *
 * @returns A client authenticated as this app, shared by every unit of work this isolate runs.
 * @example
 * let middleware = [admin(createManagementClient)];
 */
export function createManagementClient(): ManagementClient {
	return (instance ??= new ManagementClient(
		new ServiceClient(issuer(), {
			clientId: env.CLIENT_ID,
			clientSecret: env.CLIENT_SECRET,
		}),
	));
}
