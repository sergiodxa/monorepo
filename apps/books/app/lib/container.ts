/**
 * Wires up the app-wide dependency-injection container (ADR-008), registering
 * {@link Buttondown} as a scoped service so its factory reads its secret per
 * request. A missing secret then fails just that request, leaving
 * `/healthcheck` and the rest of the worker still answering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
