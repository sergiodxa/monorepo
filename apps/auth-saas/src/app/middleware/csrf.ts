import { forbidden } from "@pkg/http/response/json";
import { env } from "cloudflare:workers";

import {
	createCsrfCookie,
	extractCsrfToken,
	generateCsrfToken,
	getCsrfCookie,
	verifyCsrfToken,
} from "~/lib/csrf";
import middleware from "~/lib/middleware";

declare module "remix/fetch-router" {
	interface RequestContext {
		/** CSRF token for use in forms/headers */
		csrfToken: string;
	}
}

/**
 * CSRF protection middleware for the platform dashboard.
 * Uses double-submit cookie pattern:
 * 1. Sets a CSRF cookie with a signed token
 * 2. Requires the token to be submitted in a header or form field for POST/PUT/DELETE
 *
 * GET/HEAD/OPTIONS requests are safe methods and don't require CSRF validation.
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("csrf");
	let isProduction = !import.meta.env.DEV;

	// Get or generate CSRF token
	let cookies = context.request.headers.get("Cookie") ?? "";
	let csrfCookie = getCsrfCookie(cookies);

	// Validate existing cookie token or generate new one
	let csrfToken: string;
	if (csrfCookie && (await verifyCsrfToken(csrfCookie, env.SESSION_SECRET))) {
		csrfToken = csrfCookie;
	} else {
		csrfToken = await generateCsrfToken(env.SESSION_SECRET);
	}

	context.csrfToken = csrfToken;

	// Safe methods don't need CSRF validation
	let method = context.request.method.toUpperCase();
	if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
		let response = await next();

		// Set CSRF cookie on safe requests
		if (!csrfCookie || csrfCookie !== csrfToken) {
			let newCookie = createCsrfCookie(csrfToken, isProduction);
			let existingCookies = response.headers.get("Set-Cookie") ?? "";
			let allCookies = existingCookies ? `${existingCookies}, ${newCookie}` : newCookie;
			response = new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
			response.headers.set("Set-Cookie", allCookies);
		}

		return response;
	}

	// For state-changing methods, validate CSRF token
	let formData: FormData | undefined;

	// Only parse form data if content type is form
	let contentType = context.request.headers.get("Content-Type") ?? "";
	if (
		contentType.includes("application/x-www-form-urlencoded") ||
		contentType.includes("multipart/form-data")
	) {
		// Clone request to avoid consuming body
		let clonedRequest = context.request.clone();
		try {
			formData = await clonedRequest.formData();
		} catch {
			// Ignore parsing errors
		}
	}

	let submittedToken = extractCsrfToken(context.request, formData);

	if (!submittedToken) {
		log.info("CSRF token missing");
		return forbidden({ error: "CSRF token required" });
	}

	// Validate submitted token matches cookie
	let isValid = await verifyCsrfToken(submittedToken, env.SESSION_SECRET);

	if (!isValid || submittedToken !== csrfCookie) {
		log.info("CSRF token invalid");
		return forbidden({ error: "Invalid CSRF token" });
	}

	log.info("CSRF validation passed");

	return next();
});
