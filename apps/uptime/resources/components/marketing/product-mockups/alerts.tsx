/**
 * Alerts as a mockup: the team's alert channels with their type and scope, over the
 * history of what they sent for one incident and its recovery. Channel types and event
 * names are the alert pages' own labels.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { Badge } from "@sdxc/ui";

import type { BadgeTone } from "~/resources/components/badge";

import { badgeVariant } from "~/resources/components/badge";
import {
	DrawnButton,
	MockupWindow,
	Mono,
	Muted,
	Name,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";

/** Alert channels: name, type key and scope key under `page.alerts.table`. */
const CHANNELS = [
	["On-call", "pagerduty", "scope.teamWide"],
	["#incidents", "slack", "scope.allOfType.http"],
	["Ops inbox", "email", "scope.allOfType.cron"],
] as const;

/** One incident's deliveries, newest first: monitor, event, channel and time (UTC). */
const EVENTS: ReadonlyArray<readonly [string, "up" | "down", string, string]> = [
	["api.example.com", "up", "#incidents", "14:09"],
	["api.example.com", "up", "On-call", "14:09"],
	["api.example.com", "down", "#incidents", "14:02"],
	["api.example.com", "down", "On-call", "14:02"],
];

/** The badge tone each event draws in. */
const EVENT_TONE: Record<"up" | "down", BadgeTone> = { up: "up", down: "down" };

/** Draws the alert channels and their recent deliveries. */
export default function AlertsMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		return (
			<MockupWindow
				label={t("landing.mockups.alerts")}
				title={t("page.alerts.header.title")}
				active="alerts"
			>
				<PageTitle
					title={t("page.alerts.header.title")}
					end={<DrawnButton>{t("page.alerts.header.action.create")}</DrawnButton>}
				/>
				<Panel flush>
					<Rows
						columns="minmax(0, 1fr) auto minmax(0, 1fr)"
						head={[
							t("page.alerts.table.columns.name"),
							t("page.alerts.table.columns.strategy"),
							t("page.alerts.table.columns.scope"),
						]}
						rows={CHANNELS.map(([name, type, scope]) => ({
							key: name,
							cells: [
								<Name>{name}</Name>,
								<Badge color="neutral" variant="secondary">
									{t(`page.alerts.table.types.${type}`)}
								</Badge>,
								<Muted>{t(`page.alerts.table.${scope}`)}</Muted>,
							],
						}))}
					/>
				</Panel>
				<Panel title={t("page.alertHistory.header.title")} flush>
					<Rows
						columns="minmax(0, 1fr) auto minmax(0, 0.8fr) auto auto"
						head={[
							t("page.alertHistory.table.columns.monitor"),
							t("page.alertHistory.table.columns.eventType"),
							t("page.alertHistory.table.columns.alert"),
							t("page.alertHistory.table.columns.status"),
							t("page.alertHistory.table.columns.sentAt"),
						]}
						rows={EVENTS.map(([monitor, event, channel, time]) => ({
							key: `${event}-${channel}`,
							cells: [
								<Mono>{monitor}</Mono>,
								<Badge {...badgeVariant(EVENT_TONE[event])}>
									{t(`page.alertHistory.table.eventType.${event}`)}
								</Badge>,
								<Muted>{channel}</Muted>,
								<Muted>{t("page.alertHistory.table.status.sent")}</Muted>,
								<Muted>{time}</Muted>,
							],
						}))}
					/>
				</Panel>
			</MockupWindow>
		);
	};
}
