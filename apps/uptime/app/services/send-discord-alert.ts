import { type Result, failure, success } from "@pkg/result";

// Discord embed colors
const COLORS = {
	recovered: 0x00ff00, // Green
	down: 0xff0000, // Red
	degraded: 0xffff00, // Yellow
} as const;

type MonitorStatus = "down" | "recovered" | "degraded";

export interface DiscordAlertParams {
	webhookUrl: string;
	monitor: {
		id: string;
		name: string;
		url: string;
		team: { id: string };
	};
	status: MonitorStatus;
	timestamp: Date;
	dashboardUrl: string;
	recoveryInfo?: {
		downtimeDurationMs: number | null;
	};
}

interface DiscordEmbed {
	title: string;
	color: number;
	fields: Array<{ name: string; value: string; inline: boolean }>;
	footer: { text: string };
	timestamp: string;
}

interface DiscordWebhookPayload {
	embeds: DiscordEmbed[];
}

function formatDuration(ms: number): string {
	let seconds = Math.floor(ms / 1000);
	let minutes = Math.floor(seconds / 60);
	let hours = Math.floor(minutes / 60);

	if (hours > 0) {
		let remainingMinutes = minutes % 60;
		return `${hours}h ${remainingMinutes}m`;
	}
	if (minutes > 0) {
		let remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	}
	return `${seconds}s`;
}

function getStatusEmoji(status: MonitorStatus): string {
	switch (status) {
		case "recovered":
			return "\u{1F7E2}"; // Green circle
		case "down":
			return "\u{1F534}"; // Red circle
		case "degraded":
			return "\u{1F7E1}"; // Yellow circle
	}
}

function getStatusText(status: MonitorStatus): string {
	switch (status) {
		case "recovered":
			return "Recovered";
		case "down":
			return "Down";
		case "degraded":
			return "Degraded";
	}
}

export async function sendDiscordAlert(params: DiscordAlertParams): Promise<Result<void, Error>> {
	let { webhookUrl, monitor, status, timestamp, dashboardUrl, recoveryInfo } = params;

	let statusEmoji = getStatusEmoji(status);
	let statusText = getStatusText(status);
	let color = COLORS[status];

	let fields: Array<{ name: string; value: string; inline: boolean }> = [
		{ name: "URL", value: monitor.url, inline: true },
		{ name: "Status", value: statusText, inline: true },
		{
			name: "Time",
			value: timestamp.toISOString().replace("T", " ").replace("Z", " UTC"),
			inline: true,
		},
	];

	// Add downtime duration for recovery alerts
	if (status === "recovered" && recoveryInfo?.downtimeDurationMs) {
		fields.push({
			name: "Downtime Duration",
			value: formatDuration(recoveryInfo.downtimeDurationMs),
			inline: true,
		});
	}

	fields.push({
		name: "View Monitor",
		value: `[Dashboard](${dashboardUrl})`,
		inline: false,
	});

	let embed: DiscordEmbed = {
		title: `${statusEmoji} Monitor ${statusText}: ${monitor.name}`,
		color,
		fields,
		footer: { text: "Uptime Monitor" },
		timestamp: timestamp.toISOString(),
	};

	let payload: DiscordWebhookPayload = {
		embeds: [embed],
	};

	try {
		let response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			let errorText = await response.text();
			return failure(
				new Error(`Discord webhook failed with status ${response.status}: ${errorText}`),
			);
		}

		return success(undefined);
	} catch (error) {
		return failure(
			error instanceof Error ? error : new Error("Unknown error sending Discord alert"),
		);
	}
}
