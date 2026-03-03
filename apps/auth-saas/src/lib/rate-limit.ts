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

/**
 * Check if a request should be rate limited.
 * Returns a 429 response if rate limited, null otherwise.
 */
export async function checkRateLimit(
	request: Request,
	authLimiter: RateLimit,
	strictLimiter: RateLimit,
): Promise<Response | null> {
	let url = new URL(request.url);
	let pathname = url.pathname;

	// Get client IP for rate limit key
	let ip = request.headers.get("cf-connecting-ip") || "unknown";

	// Check strict rate limited paths first
	for (let path of STRICT_RATE_LIMITED_PATHS) {
		if (pathname === path || pathname.startsWith(path + "/")) {
			let key = `${ip}:${path}`;
			let { success } = await strictLimiter.limit({ key });

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
			let { success } = await authLimiter.limit({ key });

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
