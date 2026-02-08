/**
 * TCP Connection Check Service
 *
 * IMPORTANT: Cloudflare Workers TCP socket support (connect() API) is limited:
 * - Only available on paid plans with advanced features
 * - Free plan cannot make outbound TCP connections
 * - This implementation returns a "feature not available" status on free plans
 *
 * For production use, consider:
 * 1. Upgrading to Cloudflare Workers paid plan with socket support
 * 2. Using a proxy service that performs TCP checks
 * 3. Implementing TCP checks via an external service (webhook callback)
 */

export interface TcpCheckResult {
	status: "up" | "down" | "timeout" | "unsupported";
	responseTimeMs: number | null;
	errorMessage: string | null;
}

/**
 * Attempts to perform a TCP connection check.
 *
 * Currently returns "unsupported" status because Cloudflare Workers free plan
 * does not support outbound TCP connections via the connect() API.
 */
export async function checkTcpConnection(
	host: string,
	port: number,
	timeoutMs: number,
): Promise<TcpCheckResult> {
	let startTime = Date.now();

	try {
		// Check if the connect() API is available (Cloudflare Workers paid feature)
		// @ts-expect-error - connect is not in the standard types
		if (typeof globalThis.connect !== "function") {
			return {
				status: "unsupported",
				responseTimeMs: null,
				errorMessage:
					"TCP monitoring requires Cloudflare Workers paid plan with socket support. " +
					"Contact support or use HTTP monitoring as an alternative.",
			};
		}

		// If connect() is available, attempt the connection
		// @ts-expect-error - connect is not in the standard types
		let socket = await globalThis.connect({ hostname: host, port });

		// Create an AbortController for timeout
		let controller = new AbortController();
		let timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			// Try to establish the connection with timeout
			let writer = socket.writable.getWriter();
			await writer.ready;
			writer.releaseLock();

			// Connection successful
			clearTimeout(timeoutId);
			let responseTime = Date.now() - startTime;

			// Close the socket
			await socket.close();

			return {
				status: "up",
				responseTimeMs: responseTime,
				errorMessage: null,
			};
		} catch (error) {
			clearTimeout(timeoutId);

			if (controller.signal.aborted) {
				return {
					status: "timeout",
					responseTimeMs: timeoutMs,
					errorMessage: `Connection timed out after ${timeoutMs}ms`,
				};
			}

			throw error;
		}
	} catch (error) {
		let responseTime = Date.now() - startTime;
		let errorMessage = error instanceof Error ? error.message : String(error);

		// Check for specific error types
		if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("refused")) {
			return {
				status: "down",
				responseTimeMs: responseTime,
				errorMessage: `Connection refused to ${host}:${port}`,
			};
		}

		if (
			errorMessage.includes("ETIMEDOUT") ||
			errorMessage.includes("timeout") ||
			errorMessage.includes("TIMEOUT")
		) {
			return {
				status: "timeout",
				responseTimeMs: responseTime,
				errorMessage: `Connection timed out to ${host}:${port}`,
			};
		}

		if (
			errorMessage.includes("ENOTFOUND") ||
			errorMessage.includes("getaddrinfo") ||
			errorMessage.includes("DNS")
		) {
			return {
				status: "down",
				responseTimeMs: responseTime,
				errorMessage: `Host not found: ${host}`,
			};
		}

		return {
			status: "down",
			responseTimeMs: responseTime,
			errorMessage: errorMessage,
		};
	}
}

/**
 * Alternative: HTTP-based port check using a well-known endpoint
 * This can be used as a fallback when TCP sockets are not available.
 *
 * Note: This only works for HTTP/HTTPS ports (80, 443, 8080, etc.)
 * and services that respond to HTTP requests.
 */
export async function checkHttpPort(
	host: string,
	port: number,
	timeoutMs: number,
): Promise<TcpCheckResult> {
	let startTime = Date.now();
	let protocol = port === 443 ? "https" : "http";
	let url = `${protocol}://${host}:${port}`;

	try {
		let controller = new AbortController();
		let timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		await fetch(url, {
			method: "HEAD",
			signal: controller.signal,
		});

		clearTimeout(timeoutId);
		let responseTime = Date.now() - startTime;

		// Any response (even 4xx/5xx) means the port is open
		return {
			status: "up",
			responseTimeMs: responseTime,
			errorMessage: null,
		};
	} catch (error) {
		let responseTime = Date.now() - startTime;
		let errorMessage = error instanceof Error ? error.message : String(error);

		if (errorMessage.includes("abort") || errorMessage.includes("timeout")) {
			return {
				status: "timeout",
				responseTimeMs: responseTime,
				errorMessage: `HTTP check timed out after ${timeoutMs}ms`,
			};
		}

		return {
			status: "down",
			responseTimeMs: responseTime,
			errorMessage: `HTTP check failed: ${errorMessage}`,
		};
	}
}
