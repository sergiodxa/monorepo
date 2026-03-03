/**
 * Rate limiting utilities for auth endpoints.
 * Uses Cloudflare's Rate Limiting API binding.
 */

/**
 * Paths that require auth rate limiting (10 req/10s)
 */
const AUTH_RATE_LIMITED_PATHS = [
	"/oauth/token",
	"/webauthn/register/options",
	"/webauthn/register/verify",
	"/webauthn/auth/options",
	"/webauthn/auth/verify",
];

/**
 * Paths that require strict rate limiting (5 req/60s)
 */
const STRICT_RATE_LIMITED_PATHS = ["/verify-email"];

interface RateLimiters {
	authLimiter: RateLimit;
	strictLimiter: RateLimit;
	managementLimiter: RateLimit;
}

/**
 * Check if a request should be rate limited.
 * Returns a 429 response if rate limited, null otherwise.
 */
export async function checkRateLimit(
	request: Request,
	limiters: RateLimiters,
): Promise<Response | null> {
	let url = new URL(request.url);
	let pathname = url.pathname;

	// Get client IP for rate limit key
	let ip = request.headers.get("cf-connecting-ip") || "unknown";

	// Check Management API paths (100 req/60s per IP)
	// Note: Additional per-client rate limiting could be added in the management-auth middleware
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

	// Check strict rate limited paths first
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

	// Check auth rate limited paths
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
