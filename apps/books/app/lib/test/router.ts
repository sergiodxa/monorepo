/**
 * Drives the real application router — the same middleware chain, container
 * scope, and controllers the worker builds — end to end. A test supplies the
 * platform every route bills against and swaps the newsletter client through
 * the container, because MSW's interceptors leave the router's form-data
 * middleware reading an empty body, failing every POST before validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";
import type { ServiceKey } from "@sdxc/service-container";

import { getServiceContainer } from "@sdxc/service-container";

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
	/** The platform the request bills against, replacing the configured one. */
	billing?: Billing;
}

/**
 * Fetches a URL through the real router inside a container scope.
 *
 * @param path - A path or absolute URL to request.
 * @param options - Request init, plus `billing` to bill this request against and
 * `services` to override in this request's scope. A non-GET request gets `origin`
 * set to {@link ORIGIN} by default, since cross-origin protection is part of the
 * chain under test.
 * @returns The router's response.
 * @example await fetchApp("/release", { billing: new MemoryBilling({ catalog }) })
 */
export async function fetchApp(path: string, options: FetchAppOptions = {}): Promise<Response> {
	let { services = [], billing, ...init } = options;
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
		return await application(billing).fetch(request);
	});
}
