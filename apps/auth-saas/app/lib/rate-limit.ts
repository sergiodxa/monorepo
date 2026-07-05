/**
 * Rate limiting utilities for auth endpoints.
 * Uses Cloudflare's Rate Limiting API binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Paths that require auth rate limiting (10 req/10s).
 */
const AUTH_RATE_LIMITED_PATHS = [
	"/oauth/authorize",
	"/oauth/token",
	"/oidc/logout",
	"/oidc/userinfo",
	"/webauthn/register/options",
	"/webauthn/register/verify",
	"/webauthn/auth/options",
	"/webauthn/auth/verify",
];

/**
 * Paths that require strict rate limiting (5 req/60s).
 */
const STRICT_RATE_LIMITED_PATHS = ["/verify-email"];

/**
 * Rate limiter bindings for different endpoint categories.
 */
interface RateLimiters {
	/** Auth endpoints: 10 req/10s */
	authLimiter: RateLimit;
	/** Strict endpoints: 5 req/60s */
	strictLimiter: RateLimit;
	/** Management API: 100 req/60s */
	managementLimiter: RateLimit;
}

/**
 * Checks if a request should be rate limited based on the endpoint and client IP.
 * @param request - The incoming request
 * @param limiters - The rate limiter bindings
 * @returns A 429 response if rate limited, null otherwise
 * @example
 * let limited = await checkRateLimit(request, limiters);
 * if (limited) return limited;
 */
export async function checkRateLimit(
	request: Request,
	limiters: RateLimiters,
): Promise<Response | null> {
	let url = new URL(request.url);
	let pathname = url.pathname;

	let ip = request.headers.get("cf-connecting-ip") || "unknown";

	if (pathname.startsWith("/api/")) {
		let key = `${ip}:/api`;
		let { success } = await limiters.managementLimiter.limit({ key });

		if (!success) {
			return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"Retry-After": "60",
				},
			});
		}

		return null;
	}

	for (let path of STRICT_RATE_LIMITED_PATHS) {
		if (pathname === path || pathname.startsWith(path + "/")) {
			let key = `${ip}:${path}`;
			let { success } = await limiters.strictLimiter.limit({ key });

			if (!success) {
				return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"Retry-After": "60",
					},
				});
			}

			return null;
		}
	}

	for (let path of AUTH_RATE_LIMITED_PATHS) {
		if (pathname === path || pathname.startsWith(path + "/")) {
			let key = `${ip}:${path}`;
			let { success } = await limiters.authLimiter.limit({ key });

			if (!success) {
				return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), {
					status: 429,
					headers: {
						"Content-Type": "application/json",
						"Retry-After": "10",
					},
				});
			}

			return null;
		}
	}

	return null;
}
