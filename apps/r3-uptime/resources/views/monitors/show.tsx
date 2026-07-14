/**
 * HTTP monitor detail page. Shows the monitor's configuration, SSL status, a recent
 * latency sparkline from Analytics Engine, a calendar-year uptime heatmap from
 * `monitor_daily_stats`, and run/edit actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import {
	LockIcon,
	PencilIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
	ShieldXIcon,
} from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { SparklinePoint } from "~/app/services/analytics";
import type { SslStatus } from "~/app/services/ssl-info";
import type { SelectMonitor, SelectMonitorDailyStats } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import { calculateSslStatus } from "~/app/services/ssl-info";
import Badge from "~/resources/components/badge";
import LinkButton from "~/resources/components/link-button";
import StatCard from "~/resources/components/stat-card";
import { neutral } from "~/resources/theme";
import Sparkline from "~/resources/views/monitors/sparkline";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

namespace MonitorShowView {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		sparkline: SparklinePoint[];
		dailyStats: SelectMonitorDailyStats[];
	}
}

/** Renders configuration stat cards, the recent-latency sparkline, the uptime heatmap, and an SSL certificate card ("not configured" or expiry details, depending on whether SSL monitoring is enabled). */
export default function MonitorShowView(handle: Handle<MonitorShowView.Props>) {
	return () => {
		let { team, monitor, sparkline, dailyStats } = handle.props;

		return (
			<div>
				<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
					<StatCard label="URL" value={<code>{monitor.url}</code>} />
					<StatCard label="Method" value={monitor.method} />
					<StatCard label="Check interval" value={`${monitor.interval_seconds}s`} />
				</div>

				<h2>Recent response time</h2>
				<Sparkline points={sparkline} />

				<h2>Uptime history</h2>
				<Heatmap days={dailyStats} />

				{SslCard({ team, monitor })}
			</div>
		);
	};
}

const SSL_TONE: Record<SslStatus, BadgeTone> = {
	valid: "up",
	expiring: "degraded",
	expired: "down",
	unknown: "neutral",
};

const SSL_LABEL: Record<SslStatus, string> = {
	valid: "Valid",
	expiring: "Expiring Soon",
	expired: "Expired",
	unknown: "Not Configured",
};

const SSL_ICON: Record<SslStatus, typeof ShieldCheckIcon> = {
	valid: ShieldCheckIcon,
	expiring: ShieldAlertIcon,
	expired: ShieldXIcon,
	unknown: LockIcon,
};

const card = css({
	padding: 24,
	borderRadius: 8,
	border: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

const cardHeader = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	marginBottom: 16,
});

const cardTitleGroup = css({ display: "flex", alignItems: "center", gap: 8 });

const cardTitle = css({ margin: 0, fontSize: "1.125rem", fontWeight: 700 });

const mutedText = css({
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

const sslGrid = css({
	display: "grid",
	gap: 16,
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	alignItems: "end",
});

const sslFieldLabel = css({ fontSize: "0.8125rem", marginBottom: 4 });
const sslFieldValue = css({ fontSize: "1.125rem", fontWeight: 600 });

/** Renders the SSL certificate card: a "not configured" prompt, or the certificate's expiry/issuer details, matching {@link calculateSslStatus}'s classification. */
function SslCard(props: { team: { slug: string }; monitor: SelectMonitor }) {
	let { team, monitor } = props;
	let editHref = routes.app.team.monitors.edit.href({ team: team.slug, monitorId: monitor.id });

	if (!monitor.ssl_monitoring_enabled) {
		return (
			<div mix={[card]}>
				<div mix={[cardHeader]}>
					<div mix={[cardTitleGroup]}>
						<LockIcon size={20} strokeWidth={1.5} mix={[mutedText]} />
						<h3 mix={[cardTitle]}>SSL Certificate</h3>
					</div>
					<Badge tone="neutral">{SSL_LABEL.unknown}</Badge>
				</div>
				<div
					mix={[css({ display: "flex", alignItems: "center", justifyContent: "space-between" })]}
				>
					<p mix={[mutedText, css({ margin: 0 })]}>
						SSL monitoring is not enabled for this monitor.
					</p>
					<LinkButton href={editHref} color="primary" size="sm">
						<LockIcon size={16} strokeWidth={1.5} />
						Configure SSL Monitoring
					</LinkButton>
				</div>
			</div>
		);
	}

	let { status, daysUntilExpiry } = calculateSslStatus(
		monitor.ssl_expires_at,
		monitor.ssl_expiry_warning_days,
	);
	let Icon = SSL_ICON[status] ?? LockIcon;

	return (
		<div mix={[card]}>
			<div mix={[cardHeader]}>
				<div mix={[cardTitleGroup]}>
					<Icon size={20} strokeWidth={1.5} mix={[mutedText]} />
					<h3 mix={[cardTitle]}>SSL Certificate</h3>
				</div>
				<Badge tone={SSL_TONE[status] ?? "neutral"}>{SSL_LABEL[status] ?? status}</Badge>
			</div>
			<div mix={[sslGrid]}>
				<div>
					<p mix={[sslFieldLabel, mutedText]}>Expires</p>
					<p mix={[sslFieldValue]}>
						{monitor.ssl_expires_at === null
							? "—"
							: new Date(monitor.ssl_expires_at).toLocaleDateString()}
					</p>
					{daysUntilExpiry !== null && (
						<p mix={[mutedText, css({ fontSize: "0.8125rem" })]}>{daysUntilExpiry} days</p>
					)}
				</div>
				<div>
					<p mix={[sslFieldLabel, mutedText]}>Issuer</p>
					<p mix={[sslFieldValue]}>{monitor.ssl_issuer ?? "—"}</p>
				</div>
				<div>
					<p mix={[sslFieldLabel, mutedText]}>Last Checked</p>
					<p mix={[sslFieldValue]}>
						{monitor.ssl_last_checked_at === null
							? "—"
							: new Date(monitor.ssl_last_checked_at).toLocaleString()}
					</p>
				</div>
				<div mix={[css({ display: "flex", justifyContent: "flex-end" })]}>
					<LinkButton href={editHref} color="neutral" size="sm">
						<PencilIcon size={16} strokeWidth={1.5} />
						Configure SSL Monitoring
					</LinkButton>
				</div>
			</div>
		</div>
	);
}
