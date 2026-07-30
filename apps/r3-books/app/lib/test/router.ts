/**
 * Test-only helper that drives the real application router — the same middleware chain,
 * container scope, and controllers the worker builds — so a router-level test exercises
 * the funnel end to end instead of a hand-assembled router that can drift from
 * production.
 *
 * External clients are replaced through the container rather than at the network layer.
 * MSW cannot be used for these tests: with its interceptors installed, the router's own
 * form-data middleware sees an empty body, so every POST would fail validation before
 * reaching the code under test. The clients themselves are covered by their own
 * MSW-backed tests, which is where the request shape belongs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ServiceKey } from "@pkg/service-container";

import { getServiceContainer } from "@pkg/service-container";

import { container } from "~/app/lib/container";
import application from "~/bootstrap/app";

/** The origin every test request is made against. */
export const ORIGIN = "https://books.test";

/** One service to replace for the duration of a request, as a `[key, value]` pair. */
export type ServiceOverride = [ServiceKey<unknown>, unknown];

/** Options accepted by {@link fetchApp}. */
export interface FetchAppOptions extends RequestInit {
	/** Services to register in the request's scope, replacing the real clients. */
	services?: ServiceOverride[];
}

/**
 * Fetches a URL through the real router inside a container scope.
 *
 * @param path - A path or absolute URL to request.
 * @param options - Request init, plus `services` to override in this request's scope. A
 * non-GET request gets `origin` set to {@link ORIGIN} by default, since cross-origin
 * protection is part of the chain under test.
 * @returns The router's response.
 * @example await fetchApp("/api/subscribe", { method: "POST", body, services: [[Buttondown, fake]] })
 */
export async function fetchApp(path: string, options: FetchAppOptions = {}): Promise<Response> {
	let { services = [], ...init } = options;
	let headers = new Headers(init.headers);

	if (init.method && init.method !== "GET" && !headers.has("origin")) {
		headers.set("origin", ORIGIN);
	}

	if (init.body instanceof URLSearchParams && !headers.has("content-type")) {
		headers.set("content-type", "application/x-www-form-urlencoded");
	}

	let request = new Request(new URL(path, ORIGIN), { ...init, headers });

	return await container.scope(async () => {
		for (let [key, value] of services) getServiceContainer().instance(key, value);
		return await application().fetch(request);
	});
}
