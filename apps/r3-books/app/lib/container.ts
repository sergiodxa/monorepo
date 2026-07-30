/**
 * Wires up the app-wide dependency-injection container (ADR-008) and registers the
 * two external clients the funnel talks to: {@link Buttondown} for the newsletter and
 * {@link PolarClient} for products, checkouts, discounts, and orders. Controllers
 * resolve them from here rather than importing a module-level singleton.
 *
 * Both are registered as *scoped* rather than singleton on purpose: their factories
 * read the API secrets, so a missing secret surfaces as a handled failure inside the
 * request that needed the client, not as a module-load throw that takes down every
 * route in the worker — `/healthcheck` keeps answering either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";

import { Buttondown } from "~/app/services/buttondown";

/**
 * The app service container (ADR-008). Registered once per isolate; the worker wraps
 * each request in `container.scope(...)`, so controllers resolve dependencies with
 * `inject([Buttondown, ...])` instead of constructing clients themselves.
 *
 * @example
 * await container.scope(() => router.fetch(request));
 */
export const container = new ServiceContainer();

container.scoped(Buttondown, () => new Buttondown({ apiKey: env.BUTTONDOWN_API_KEY }));
container.scoped(
	PolarClient,
	() => new PolarClient({ accessToken: requireSecret("POLAR_ACCESS_TOKEN") }),
);

/**
 * Reads a required secret, failing with the variable's name rather than letting an
 * empty token reach Polar and come back as an opaque 401.
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
