/**
 * Drives the real application router — the same middleware chain and controllers the
 * worker builds — end to end, so a test asserts against the bytes a visitor receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import application from "~/bootstrap/app";

/** The origin every test request is made against. */
export const ORIGIN = "https://sdxc.test";

/**
 * Fetches a URL through the real router.
 *
 * @param path - A path or absolute URL to request.
 * @param init - Request init; a non-GET request gets `origin` set to {@link ORIGIN} by
 * default, since cross-origin protection is part of the chain under test.
 * @returns The router's response.
 * @example await fetchApp("/")
 */
export async function fetchApp(path: string, init: RequestInit = {}): Promise<Response> {
	let headers = new Headers(init.headers);

	if (init.method && init.method !== "GET" && !headers.has("origin")) {
		headers.set("origin", ORIGIN);
	}

	let request = new Request(new URL(path, ORIGIN), { ...init, headers });

	return await application().fetch(request);
}
