import { forbidden } from "@pkg/http/response/json";

import middleware from "~/app/lib/middleware";

/**
 * Valid values for the Sec-Fetch-Site header.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Fetch-Site
 */
type FetchSite = "cross-site" | "same-origin" | "same-site" | "none";

/**
 * Extracts and validates the Sec-Fetch-Site header from a request.
 * @param request - The incoming HTTP request
 * @returns The validated FetchSite value, or null if missing or invalid
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Fetch-Site
 */
function fetchSite(request: Request): FetchSite | null {
	let header = request.headers.get("Sec-Fetch-Site");
	if (!header) return null;

	let validValues: FetchSite[] = ["cross-site", "same-origin", "same-site", "none"];
	if (validValues.includes(header as FetchSite)) {
		return header as FetchSite;
	}

	return null;
}

/**
 * Extracts the origin from a request by checking multiple sources in order:
 * 1. The Origin header
 * 2. The Referer header
 * 3. The request.referrer property
 *
 * This fallback chain ensures compatibility with older browsers that may not
 * send the Origin header consistently.
 *
 * @param request - The incoming HTTP request
 * @returns The normalized origin string, or null if no valid origin found
 */
function getRequestOrigin(request: Request): string | null {
	let origin = request.headers.get("Origin");
	if (origin) {
		try {
			return new URL(origin.toLowerCase().trim()).origin;
		} catch {
			// Invalid URL, try next source
		}
	}

	let referer = request.headers.get("Referer");
	if (referer) {
		try {
			return new URL(referer.toLowerCase().trim()).origin;
		} catch {
			// Invalid URL, try next source
		}
	}

	if (request.referrer) {
		try {
			return new URL(request.referrer.toLowerCase().trim()).origin;
		} catch {
			// Invalid URL, no more sources
		}
	}

	return null;
}

/**
 * CSRF protection middleware for the platform dashboard.
 *
 * Uses the Sec-Fetch-Site header to determine request origin.
 * Requests from same-origin or same-site are automatically allowed.
 * Cross-site requests are rejected.
 *
 * GET/HEAD/OPTIONS requests are safe methods and don't require CSRF validation.
 *
 * For browsers that don't send Sec-Fetch-Site, falls back to Origin/Referer
 * header validation.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Fetch-Site
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("csrf");

	let method = context.request.method.toUpperCase();
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
		return await next();
	}

	let site = fetchSite(context.request);

	if (site === "same-origin" || site === "same-site") {
		return await next();
	}

	/**
	 * Fallback for older browsers that don't send Sec-Fetch-Site header.
	 * Validates the request origin against the expected origin using
	 * Origin or Referer headers.
	 */
	if (site === null) {
		let requestOrigin = getRequestOrigin(context.request);
		let expectedOrigin = new URL(context.request.url).origin;

		if (requestOrigin && requestOrigin === expectedOrigin) {
			log.info("CSRF validation passed via Origin header fallback");
			return await next();
		}

		if (import.meta.env.DEV && !requestOrigin) {
			log.info("CSRF validation skipped in dev mode (no origin)");
			return await next();
		}

		log.info("CSRF validation failed - missing origin headers");
		return forbidden({ error: "Request origin could not be verified" });
	}

	/**
	 * site === "none" means the request was initiated by the user directly
	 * (e.g., typing URL in address bar). This shouldn't normally happen for
	 * POST requests, but we allow it as a safety measure.
	 */
	if (site === "none") {
		return await next();
	}

	log.info("CSRF validation failed - cross-site request", {
		site,
		origin: getRequestOrigin(context.request),
	});

	return forbidden({ error: "Cross-site requests are not allowed" });
});
