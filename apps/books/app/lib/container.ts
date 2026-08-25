/**
 * Wires up the app-wide dependency-injection container (ADR-008), registering
 * {@link Buttondown} and {@link PolarClient} as scoped services so each
 * factory reads its secret per request. A missing secret then fails just
 * that request, leaving `/healthcheck` and the rest of the worker still
 * answering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";

import { Buttondown } from "~/app/services/buttondown";

/**
 * The app service container (ADR-008). Registered once per isolate; the worker
 * wraps each request in `container.scope(...)`, so controllers resolve
 * dependencies through `inject([Buttondown, ...])`.
 *
 * @example
 * await container.scope(() => router.fetch(request));
 */
export const container = new ServiceContainer();

container.scoped(
	Buttondown,
	() =>
		new Buttondown({
			apiKey: env.BUTTONDOWN_API_KEY,
			apiVersion: env.BUTTONDOWN_API_VERSION,
		}),
);
container.scoped(
	PolarClient,
	() => new PolarClient({ accessToken: requireSecret("POLAR_ACCESS_TOKEN") }),
);

/**
 * Reads a required secret, throwing with the variable's name when it is
 * empty, so a missing token is diagnosable immediately, before it reaches
 * Polar as an opaque 401.
 *
 * @param name - The environment variable to read.
 * @returns The secret's value.
 * @throws {Error} When the variable is unset or empty.
 */
function requireSecret(name: "POLAR_ACCESS_TOKEN"): string {
	let value = env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}
