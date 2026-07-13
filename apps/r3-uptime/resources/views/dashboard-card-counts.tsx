/**
 * Dashboard per-monitor-type count stat-card fragment (HTTP, DNS, TCP, cron jobs,
 * SSL): rendered with no document shell so the dashboard's counts `Frame` can swap it
 * in over its skeleton fallback once the monitor tables resolve.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";

namespace DashboardCardCountsView {
	export interface Props {
		httpCounts: { total: number; up: number; down: number };
		dnsCounts: { total: number; ok: number; changed: number; error: number };
		tcpCounts: { total: number; up: number; down: number };
		cronCounts: { total: number; healthy: number; late: number; missed: number };
		sslCounts: { total: number; valid: number; expiring: number; expired: number };
	}
}

export default function DashboardCardCountsView(handle: Handle<DashboardCardCountsView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<>
				<StatCard
					label="HTTP Monitors"
					value={
						<>
							{props.httpCounts.total}
							<Subtitle>
								{props.httpCounts.up} up / {props.httpCounts.down} down
							</Subtitle>
						</>
					}
				/>

				<StatCard
					label="DNS Monitors"
					value={
						<>
							{props.dnsCounts.total}
							<Subtitle>
								{props.dnsCounts.ok} ok / {props.dnsCounts.changed} changed /{" "}
								{props.dnsCounts.error} error
							</Subtitle>
						</>
					}
				/>

				<StatCard
					label="TCP Monitors"
					value={
						<>
							{props.tcpCounts.total}
							<Subtitle>
								{props.tcpCounts.up} up / {props.tcpCounts.down} down
							</Subtitle>
						</>
					}
				/>

				<StatCard
					label="Cron Jobs"
					value={
						<>
							{props.cronCounts.total}
							<Subtitle>
								{props.cronCounts.healthy} healthy / {props.cronCounts.late} late /{" "}
								{props.cronCounts.missed} missed
							</Subtitle>
						</>
					}
				/>

				<StatCard
					label="SSL Monitors"
					value={
						<>
							{props.sslCounts.total}
							<Subtitle>
								{props.sslCounts.valid} valid, {props.sslCounts.expiring} expiring,{" "}
								{props.sslCounts.expired} expired
							</Subtitle>
						</>
					}
				/>
			</>
		);
	};
}
