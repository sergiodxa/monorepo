/**
 * Raw TCP connectivity check for TCP monitors, using the Workers `cloudflare:sockets`
 * API (requires the account's Workers plan to support outbound sockets). See
 * `docs/tcp-monitors.md` for the up/down/timeout status model this implements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { connect } from "cloudflare:sockets";

export type TcpCheckStatus = "up" | "down" | "timeout";

export interface TcpCheckResult {
	status: TcpCheckStatus;
	responseTimeMs: number | null;
	errorMessage?: string;
}

const TIMED_OUT = Symbol("timed-out");

/**
 * Attempts a raw TCP connection to `host:port`, succeeding once the socket opens.
 * Resolves to `timeout` when `opened` doesn't settle within `timeoutMs`, and to
 * `down` on any connection error (refused, DNS failure, etc).
 */
export async function checkTcpConnection(
	host: string,
	port: number,
	timeoutMs: number,
): Promise<TcpCheckResult> {
	let startedAt = performance.now();
	let socket = connect({ hostname: host, port });
	/**
	 * Kept so the losing side of the race below can be cancelled. An uncleared timer
	 * keeps the invocation alive for the whole `timeoutMs` even when the socket opened
	 * in milliseconds, which is what made a sequential sweep cost `N × timeoutMs`
	 * instead of `N × actual latency` (ADR-008).
	 */
	let timeout: ReturnType<typeof setTimeout> | undefined;

	try {
		let outcome = await Promise.race([
			socket.opened.then(() => "connected" as const),
			new Promise<typeof TIMED_OUT>((resolve) => {
				timeout = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
			}),
		]);

		let responseTimeMs = Math.round(performance.now() - startedAt);

		if (outcome === TIMED_OUT) {
			return {
				status: "timeout",
				responseTimeMs,
				errorMessage: `Connection timed out after ${timeoutMs}ms`,
			};
		}

		return { status: "up", responseTimeMs };
	} catch (error) {
		return {
			status: "down",
			responseTimeMs: Math.round(performance.now() - startedAt),
			errorMessage: error instanceof Error ? error.message : String(error),
		};
	} finally {
		clearTimeout(timeout);
		await socket.close().catch(() => {});
	}
}
