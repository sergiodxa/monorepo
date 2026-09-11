/**
 * Drives the real application router — the same middleware chain and controllers
 * the worker builds — end to end. A test supplies the platform every route bills
 * against directly, because MSW's interceptors leave the router's form-data
 * middleware reading an empty body, failing every POST before validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@sdxc/billing";

import application from "~/bootstrap/app";

/** The origin every test request is made against. */
export const ORIGIN = "https://books.test";

/** Options accepted by {@link fetchApp}. */
export interface FetchAppOptions extends RequestInit {
	/** The platform the request bills against, replacing the configured one. */
	billing?: Billing;
}

/**
 * Fetches a URL through the real router.
 *
 * @param path - A path or absolute URL to request.
 * @param options - Request init, plus `billing` to bill this request against. A
 * non-GET request gets `origin` set to {@link ORIGIN} by default, since
 * cross-origin protection is part of the chain under test.
 * @returns The router's response.
 * @example await fetchApp("/release", { billing: new MemoryBilling({ catalog }) })
 */
export async function fetchApp(path: string, options: FetchAppOptions = {}): Promise<Response> {
	let { billing, ...init } = options;
	let headers = new Headers(init.headers);

	if (init.method && init.method !== "GET" && !headers.has("origin")) {
		headers.set("origin", ORIGIN);
	}

	if (init.body instanceof URLSearchParams && !headers.has("content-type")) {
		headers.set("content-type", "application/x-www-form-urlencoded");
	}

	let request = new Request(new URL(path, ORIGIN), { ...init, headers });

	return await application(billing).fetch(request);
}
