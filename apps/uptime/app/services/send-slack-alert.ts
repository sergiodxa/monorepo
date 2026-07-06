/**
 * Slack alert service. It builds a Block Kit message with colored attachments for
 * down, recovered, and degraded monitor events—showing status, time, downtime
 * duration, and a "View Monitor" button—and POSTs it to a Slack webhook. It
 * exists to deliver monitor status notifications to a team's Slack channel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Json } from "@pkg/http/content-type";
import { type Result, failure, success } from "@pkg/result";

export interface SlackAlertParams {
	webhookUrl: string;
	channel?: string;
	monitor: {
		name: string;
		url: string;
		id: string;
		team: { id: string };
	};
	status: "down" | "recovered" | "degraded";
	timestamp: Date;
	dashboardUrl: string;
	recoveryInfo?: {
		downtimeDurationMs: number | null;
	};
}

interface SlackBlock {
	type: string;
	text?: { type: string; text: string; emoji?: boolean };
	fields?: Array<{ type: string; text: string }>;
	accessory?: {
		type: string;
		text: { type: string; text: string; emoji?: boolean };
		url: string;
		action_id: string;
	};
}

interface SlackMessage {
	channel?: string;
	attachments: Array<{
		color: string;
		blocks: SlackBlock[];
	}>;
}

function getStatusEmoji(status: SlackAlertParams["status"]): string {
	switch (status) {
		case "down":
			return "🔴";
		case "recovered":
			return "🟢";
		case "degraded":
			return "🟡";
	}
}

function getStatusColor(status: SlackAlertParams["status"]): string {
	switch (status) {
		case "down":
			return "#dc2626"; // red
		case "recovered":
			return "#16a34a"; // green
		case "degraded":
			return "#ca8a04"; // yellow
	}
}

function getStatusText(status: SlackAlertParams["status"]): string {
	switch (status) {
		case "down":
			return "Down";
		case "recovered":
			return "Recovered";
		case "degraded":
			return "Degraded";
	}
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

function buildSlackMessage(params: SlackAlertParams): SlackMessage {
	let { monitor, status, timestamp, dashboardUrl, channel, recoveryInfo } = params;

	let emoji = getStatusEmoji(status);
	let color = getStatusColor(status);
	let statusText = getStatusText(status);

	let headerText =
		status === "down"
			? `${emoji} Monitor Down: ${monitor.name}`
			: status === "recovered"
				? `${emoji} Monitor Recovered: ${monitor.name}`
				: `${emoji} Monitor Degraded: ${monitor.name}`;

	let fields: Array<{ type: string; text: string }> = [
		{ type: "mrkdwn", text: `*URL:*\n${monitor.url}` },
		{ type: "mrkdwn", text: `*Status:*\n${statusText}` },
		{ type: "mrkdwn", text: `*Time:*\n${timestamp.toISOString()}` },
	];

	// Add downtime duration for recovery alerts
	if (status === "recovered" && recoveryInfo?.downtimeDurationMs) {
		fields.push({
			type: "mrkdwn",
			text: `*Downtime:*\n${formatDuration(recoveryInfo.downtimeDurationMs)}`,
		});
	}

	let blocks: SlackBlock[] = [
		{
			type: "header",
			text: { type: "plain_text", text: headerText, emoji: true },
		},
		{
			type: "section",
			fields,
		},
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: " ",
			},
			accessory: {
				type: "button",
				text: { type: "plain_text", text: "View Monitor", emoji: true },
				url: dashboardUrl,
				action_id: "view_monitor",
			},
		},
	];

	let message: SlackMessage = {
		attachments: [{ color, blocks }],
	};

	if (channel) {
		message.channel = channel;
	}

	return message;
}

export async function sendSlackAlert(
	params: SlackAlertParams,
): Promise<Result<{ ok: true }, Error>> {
	let message = buildSlackMessage(params);

	let response = await fetch(params.webhookUrl, {
		method: "POST",
		headers: { "Content-Type": Json },
		body: JSON.stringify(message),
	});

	if (!response.ok) {
		let errorText = await response.text();
		return failure(new Error(`Slack webhook failed: ${response.status} - ${errorText}`));
	}

	return success({ ok: true });
}
