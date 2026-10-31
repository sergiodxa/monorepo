/**
 * The checks below HTTP as a mockup: a domain's tracked DNS records with one that
 * changed, TCP ports with their connect times, and a certificate's expiry. `lead` picks
 * the check a page sells, drawn first and lit in the rail, over one companion check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import type { BadgeTone } from "~/resources/components/badge";

import { badgeVariant } from "~/resources/components/badge";
import {
	MockupWindow,
	Mono,
	Muted,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";

/** A network check a page can lead with. */
export type NetworkCheck = "dns" | "tcp" | "ssl";

/** Tracked records: name, type, value and state key under `page.dnsMonitorDetail.records.state`. */
const RECORDS = [
	["example.com", "A", "203.0.113.10", "ok"],
	["example.com", "MX", "10 mail.example.com", "ok"],
	["www", "CNAME", "example.com", "ok"],
	["example.com", "TXT", "v=spf1 include:_spf.example.net ~all", "changed"],
] as const;

/** The badge tone each record state draws in. */
const RECORD_TONE: Record<(typeof RECORDS)[number][3], BadgeTone> = {
	ok: "up",
	changed: "degraded",
};

/** TCP endpoints: name, host and port, and connect time. */
const PORTS = [
	["Postgres", "db.example.com:5432", "12 ms"],
	["Redis", "cache.example.com:6379", "4 ms"],
	["SMTP", "mail.example.com:587", "31 ms"],
] as const;

/** The second check each lead is drawn with, the one a reader of that page also cares about. */
const COMPANION: Record<NetworkCheck, NetworkCheck> = { dns: "ssl", tcp: "dns", ssl: "dns" };

/** Draws the `lead` check over its companion. */
export default function NetworkMockup(handle: Handle<{ t: Translate; lead: NetworkCheck }>) {
	return () => {
		let { lead, t } = handle.props;
		let panels: Record<NetworkCheck, RemixNode> = {
			dns: (
				<Panel key="dns" title={t("page.dnsMonitorDetail.records.title")} flush>
					<Rows
						columns="auto auto minmax(0, 1fr) auto"
						head={[
							t("page.dnsMonitorDetail.records.table.columns.name"),
							t("page.dnsMonitorDetail.records.table.columns.type"),
							t("page.dnsMonitorDetail.records.table.columns.value"),
							t("page.dnsMonitorDetail.records.table.columns.state"),
						]}
						rows={RECORDS.map(([name, type, value, state]) => ({
							key: `${name}-${type}`,
							cells: [
								<Mono>{name}</Mono>,
								<Badge color="neutral" variant="secondary">
									{type}
								</Badge>,
								<Mono muted>{value}</Mono>,
								<Badge {...badgeVariant(RECORD_TONE[state])}>
									{t(`page.dnsMonitorDetail.records.state.${state}`)}
								</Badge>,
							],
						}))}
					/>
				</Panel>
			),
			tcp: (
				<Panel key="tcp" title={t("page.tcpMonitors.table.label")} flush>
					<Rows
						columns="minmax(0, 0.7fr) minmax(0, 1.4fr) auto auto"
						head={[
							t("page.tcpMonitors.table.columns.name"),
							t("page.tcpMonitors.table.columns.endpoint"),
							t("page.tcpMonitors.table.columns.responseTime"),
							t("page.tcpMonitors.table.columns.status"),
						]}
						rows={PORTS.map(([name, endpoint, time]) => ({
							key: name,
							cells: [
								<Muted>{name}</Muted>,
								<Mono>{endpoint}</Mono>,
								<Muted>{time}</Muted>,
								<Badge {...badgeVariant("up")}>{t("page.tcpMonitors.table.status.up")}</Badge>,
							],
						}))}
					/>
				</Panel>
			),
			ssl: (
				<Panel
					key="ssl"
					title={t("page.monitor.ssl.title")}
					end={<Badge {...badgeVariant("up")}>{t("page.monitor.ssl.status.valid")}</Badge>}
				>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
								gap: "0.75rem",
							}),
						]}
					>
						<Fact label={t("page.monitor.ssl.expiresAt")}>
							{t("page.monitor.ssl.expiresIn", { days: 64 })}
						</Fact>
						<Fact label={t("page.monitor.ssl.issuer")}>Let's Encrypt</Fact>
						<Fact label={t("page.monitor.ssl.lastChecked")}>06:00 UTC</Fact>
					</div>
				</Panel>
			),
		};
		return (
			<MockupWindow
				label={t(`landing.mockups.${lead}`)}
				title={t(
					`app.layout.sidebar.navigation.items.${lead === "ssl" ? "httpMonitors" : `${lead}Monitors`}`,
				)}
				active={lead === "ssl" ? "http" : lead}
			>
				<PageTitle title="example.com" />
				{panels[lead]}
				{panels[COMPANION[lead]]}
			</MockupWindow>
		);
	};
}

/** One labelled figure in the certificate panel. */
function Fact(handle: Handle<{ label: string; children: string }>) {
	return () => (
		<span mix={[vstack({ gap: 0.5, align: "start" }), raw({ minInlineSize: "0" })]}>
			<span mix={[text("xs"), fg("neutral.muted")]}>{handle.props.label}</span>
			<span mix={[weight("medium"), fg("neutral.emphasis")]}>{handle.props.children}</span>
		</span>
	);
}
