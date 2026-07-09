/**
 * Public status page: header, an optional overall-status banner, one card per
 * attached HTTP/DNS/TCP monitor (status + 365-day heatmap) and cron job (status +
 * schedule + last ping), an empty state when nothing is attached, and a footer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { ServiceStatus } from "~/app/services/status-page";
import type { SelectMonitorDailyStats, SelectStatusPage } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import * as s from "~/resources/styles";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

interface HeatmapService {
	kind: "http" | "dns" | "tcp";
	id: string;
	name: string;
	status: ServiceStatus;
	days: SelectMonitorDailyStats[];
}

interface CronService {
	kind: "cron";
	id: string;
	name: string;
	cronExpression: string;
	lastPingAt: number | null;
	status: ServiceStatus;
}

namespace StatusPageView {
	export interface Props {
		page: SelectStatusPage;
		overallStatus: ServiceStatus;
		httpServices: HeatmapService[];
		dnsServices: HeatmapService[];
		tcpServices: HeatmapService[];
		cronServices: CronService[];
	}
}

const BANNER_MIX: Record<ServiceStatus, typeof s.bannerOperational> = {
	operational: s.bannerOperational,
	degraded: s.bannerDegraded,
	down: s.bannerDown,
	unknown: s.bannerOperational,
};

const BANNER_LABEL: Record<ServiceStatus, string> = {
	operational: "All Systems Operational",
	degraded: "Partial System Outage",
	down: "Major System Outage",
	unknown: "All Systems Operational",
};

const BADGE_TONE: Record<ServiceStatus, BadgeTone> = {
	operational: "up",
	degraded: "degraded",
	down: "down",
	unknown: "neutral",
};

const BADGE_LABEL: Record<ServiceStatus, string> = {
	operational: "Operational",
	degraded: "Degraded",
	down: "Down",
	unknown: "Unknown",
};

export default function StatusPageView(handle: Handle<StatusPageView.Props>) {
	return () => {
		let { page, overallStatus, httpServices, dnsServices, tcpServices, cronServices } =
			handle.props;
		let heatmapServices = [...httpServices, ...dnsServices, ...tcpServices];
		let isEmpty = heatmapServices.length === 0 && cronServices.length === 0;

		return (
			<main mix={[s.container]}>
				<div mix={[s.row]}>
					{page.logo_url && <img src={page.logo_url} alt={page.name} width={40} height={40} />}
					<div>
						<h1>{page.title}</h1>
						{page.description && <p mix={[s.mutedSmall]}>{page.description}</p>}
					</div>
				</div>

				{page.show_overall_status && (
					<div mix={[s.banner, BANNER_MIX[overallStatus]]}>{BANNER_LABEL[overallStatus]}</div>
				)}

				{isEmpty ? (
					<EmptyState message="No services are configured for this status page." />
				) : (
					<>
						{heatmapServices.map((service) => (
							<div key={`${service.kind}-${service.id}`} mix={[s.serviceCard]}>
								<div mix={[s.row]}>
									<strong>{service.name}</strong>
									<Badge tone={BADGE_TONE[service.status]}>{BADGE_LABEL[service.status]}</Badge>
								</div>
								<Heatmap days={service.days} />
							</div>
						))}

						{cronServices.length > 0 && (
							<>
								{heatmapServices.length > 0 && <h2>Cron Jobs</h2>}
								{cronServices.map((service) => (
									<div key={service.id} mix={[s.serviceCard]}>
										<div mix={[s.row]}>
											<strong>{service.name}</strong>
											<Badge tone={BADGE_TONE[service.status]}>{BADGE_LABEL[service.status]}</Badge>
										</div>
										<p mix={[s.mutedSmall]}>
											Schedule: <code>{service.cronExpression}</code>
										</p>
										<p mix={[s.mutedSmall]}>
											Last ping:{" "}
											{service.lastPingAt ? new Date(service.lastPingAt).toLocaleString() : "never"}
										</p>
									</div>
								))}
							</>
						)}
					</>
				)}

				<p mix={[s.mutedSmall]}>
					Last updated {new Date().toLocaleString()} ·{" "}
					<a href={routes.home.href()} mix={[s.link]}>
						Powered by Uptime
					</a>
				</p>
			</main>
		);
	};
}
