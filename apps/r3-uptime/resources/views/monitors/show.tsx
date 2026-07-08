/**
 * HTTP monitor detail page. Shows the monitor's configuration, SSL status, a recent
 * latency sparkline from Analytics Engine, and run/edit actions. The 365-day daily
 * history view is a later phase (`monitor_daily_stats` isn't populated until the daily
 * aggregation job exists), so this page focuses on the monitor's current config and
 * recent activity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SparklinePoint } from "~/app/services/analytics";
import type { SelectMonitor } from "~/database/schema";

import { calculateSslStatus } from "~/app/services/ssl-info";
import * as s from "~/resources/styles";
import Sparkline from "~/resources/views/monitors/sparkline";
import routes from "~/routes/web";

namespace MonitorShowView {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		sparkline: SparklinePoint[];
	}
}

export default function MonitorShowView(handle: Handle<MonitorShowView.Props>) {
	return () => {
		let { team, monitor, sparkline } = handle.props;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>{monitor.name}</h1>
					<form method="post" action={routes.actions.playMonitor.href({ team: team.slug })}>
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<button type="submit" mix={[s.buttonSecondary]}>
							Run now
						</button>
					</form>
					<a
						href={routes.app.team.monitorEdit.href({ team: team.slug, monitorId: monitor.id })}
						mix={[s.buttonSecondary]}
					>
						Edit
					</a>
				</div>

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>URL</div>
						<code>{monitor.url}</code>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Method</div>
						<div mix={[s.statValue]}>{monitor.method}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Check interval</div>
						<div mix={[s.statValue]}>{monitor.interval_seconds}s</div>
					</div>
				</div>

				<h2>Recent response time</h2>
				<Sparkline points={sparkline} />

				<h2>SSL certificate</h2>
				{SslSummary({ monitor })}
			</div>
		);
	};
}

function SslSummary(props: { monitor: SelectMonitor }) {
	if (!props.monitor.ssl_monitoring_enabled) {
		return <p mix={[s.mutedSmall]}>SSL monitoring is not enabled for this monitor.</p>;
	}

	let { status, daysUntilExpiry } = calculateSslStatus(
		props.monitor.ssl_expires_at,
		props.monitor.ssl_expiry_warning_days,
	);

	return (
		<div mix={[s.statRow]}>
			<div mix={[s.statCard]}>
				<div mix={[s.mutedSmall]}>Status</div>
				<span
					mix={[
						s.badge,
						status === "valid"
							? s.badgeUp
							: status === "expiring"
								? s.badgeDegraded
								: status === "expired"
									? s.badgeDown
									: s.badgeNeutral,
					]}
				>
					{status}
				</span>
			</div>
			<div mix={[s.statCard]}>
				<div mix={[s.mutedSmall]}>Days until expiry</div>
				<div mix={[s.statValue]}>{daysUntilExpiry ?? "—"}</div>
			</div>
			<div mix={[s.statCard]}>
				<div mix={[s.mutedSmall]}>Issuer</div>
				<div mix={[s.statValue]}>{props.monitor.ssl_issuer ?? "—"}</div>
			</div>
		</div>
	);
}
