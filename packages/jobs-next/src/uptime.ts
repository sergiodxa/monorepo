/**
 * The monitor ping a job sends once it completes. Reporting is separate from the
 * job's own outcome: the service having a bad minute is not a reason to retry work
 * that already succeeded, so failures here are raised as their own errors for the
 * lifecycle to log and ack.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const UPTIME_URL = new URL("https://uptime.sergiodxa.com");

/** The ping reached the service and it refused. */
export class UptimeFetchError extends Error {
	override name = "UptimeFetchError";

	constructor(status: number, body: string) {
		super(`Fetch failed with status ${status}: ${body}`);
	}
}

/** The ping never got an answer. */
export class UptimeNetworkError extends Error {
	override name = "UptimeNetworkError";

	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
	}
}

/**
 * Reports a completed run to its cron monitor. Does nothing unless the job
 * declares a monitor and the router was given a token.
 *
 * @param monitorId The monitor to ping, from the job's declaration.
 * @param token Bearer token for the uptime service.
 * @throws {UptimeFetchError} The service refused the ping.
 * @throws {UptimeNetworkError} The ping never got an answer.
 */
export async function ping(
	monitorId: string | undefined,
	token: string | undefined,
): Promise<void> {
	if (monitorId === undefined || token === undefined) return;

	let url = new URL(`/api/v1/cron-jobs/${monitorId}/ping`, UPTIME_URL);

	let headers = new Headers();
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("Content-Type", "application/json");

	try {
		let response = await fetch(url, { method: "POST", headers });
		if (response.ok) return;
		throw new UptimeFetchError(response.status, await response.text());
	} catch (error) {
		if (error instanceof UptimeFetchError) throw error;
		throw new UptimeNetworkError("Failed to send ping to uptime service", {
			cause: error instanceof Error ? error : undefined,
		});
	}
}
