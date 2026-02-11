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
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		console.error(`Failed to ping cron job monitor ${cronJobMonitorId}:`, error);
	}
}
