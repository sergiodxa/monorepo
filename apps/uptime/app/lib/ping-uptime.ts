/**
 * A tiny client helper that sends a heartbeat to a cron job monitor's public ping endpoint.
 * Given a monitor UUID and an API key, it POSTs an authenticated request to the Uptime API,
 * skipping when no key is supplied and swallowing network errors so callers never fail. It
 * exists so scheduled jobs can report that they ran.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Json } from "@pkg/http/content-type";

/**
 * Ping a cron job monitor to indicate the job is running
 * @param cronJobMonitorId - The UUID of the cron job monitor
 * @param apiKey - The API key for authentication
 */
export async function pingUptime(cronJobMonitorId: string, apiKey?: string): Promise<void> {
	if (!apiKey) {
		console.warn("API key not provided, skipping cron job monitor ping");
		return;
	}

	try {
		await fetch(`https://uptime.sergiodxa.com/api/v1/cron-jobs/${cronJobMonitorId}/ping`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": Json,
			},
		});
	} catch (error) {
		console.error(`Failed to ping cron job monitor ${cronJobMonitorId}:`, error);
	}
}
