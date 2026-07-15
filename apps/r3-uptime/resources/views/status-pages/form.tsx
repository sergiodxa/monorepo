/**
 * Shared status-page form fields, used by both the new-page and edit-page views:
 * name/slug/title/description/logo, the public/overall-status toggles, a flat
 * "Monitors to Include" checkbox list spanning HTTP, DNS, and TCP monitors, and a
 * separate "Cron Jobs to Include" checkbox list. SSL monitors have no section here
 * — see `app/data/status-page.ts`'s docblock for why. Each checkbox keeps the
 * `name` matching the monitor table it belongs to (`monitor_ids`, `dns_monitor_ids`,
 * `tcp_monitor_ids`, `cron_job_ids`) so the create/update actions can still tell
 * them apart, even though they render side by side with no per-type grouping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectStatusPage,
	SelectTcpMonitor,
} from "~/database/schema";

import Field from "~/resources/components/field";
import { neutral } from "~/resources/theme";

namespace StatusPageFormFields {
	export interface Props {
		monitors: SelectMonitor[];
		dnsMonitors: SelectDnsMonitor[];
		tcpMonitors: SelectTcpMonitor[];
		cronJobs: SelectCronJobMonitor[];
		page?: SelectStatusPage;
		attachedMonitorIds?: string[];
		attachedDnsMonitorIds?: string[];
		attachedTcpMonitorIds?: string[];
		attachedCronJobIds?: string[];
		/** The request's i18next instance, used to read this page's `page.statusPages.form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/** Renders the page identity fields, a flat "Monitors to Include" list merging HTTP/DNS/TCP monitors, and a "Cron Jobs to Include" list (each hidden when empty), pre-checked from the `attached*Ids` props. */
export default function StatusPageFormFields(handle: Handle<StatusPageFormFields.Props>) {
	return () => {
		let {
			monitors,
			dnsMonitors,
			tcpMonitors,
			cronJobs,
			page,
			attachedMonitorIds = [],
			attachedDnsMonitorIds = [],
			attachedTcpMonitorIds = [],
			attachedCronJobIds = [],
			i18next,
		} = handle.props;

		let t = i18next.getFixedT(null, "translation", "page.statusPages.form.fields");

		let selectableMonitors = [
			...monitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				fieldName: "monitor_ids",
				checked: attachedMonitorIds.includes(monitor.id),
			})),
			...dnsMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				fieldName: "dns_monitor_ids",
				checked: attachedDnsMonitorIds.includes(monitor.id),
			})),
			...tcpMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				fieldName: "tcp_monitor_ids",
				checked: attachedTcpMonitorIds.includes(monitor.id),
			})),
		];

		return (
			<>
				<Field label="Name">
					<input
						type="text"
						name="name"
						required
						defaultValue={page?.name}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Slug">
					<input
						type="text"
						name="slug"
						required
						defaultValue={page?.slug}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						Lowercase letters, numbers, and hyphens only.
					</p>
				</Field>

				<Field label="Title">
					<input
						type="text"
						name="title"
						required
						defaultValue={page?.title}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Description">
					<textarea
						name="description"
						defaultValue={page?.description ?? ""}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<Field label="Logo URL">
					<input
						type="url"
						name="logo_url"
						defaultValue={page?.logo_url ?? ""}
						mix={[
							css({
								padding: "8px 12px",
								borderRadius: 6,
								border: `1px solid ${neutral[200]}`,
								fontSize: "0.875rem",
								fontFamily: "inherit",
								background: neutral[50],
								color: "inherit",
								"@media (prefers-color-scheme: dark)": {
									borderColor: neutral[700],
									background: neutral[900],
								},
							}),
						]}
					/>
				</Field>

				<label
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 16,
							fontSize: "0.875rem",
						}),
					]}
				>
					<input
						type="checkbox"
						name="is_public"
						value="true"
						defaultChecked={page?.is_public ?? true}
					/>
					<span>Public — anyone with the link can view this page</span>
				</label>

				<label
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginBottom: 16,
							fontSize: "0.875rem",
						}),
					]}
				>
					<input
						type="checkbox"
						name="show_overall_status"
						value="true"
						defaultChecked={page?.show_overall_status ?? true}
					/>
					<span>Show the overall status banner</span>
				</label>

				{selectableMonitors.length > 0 && (
					<div mix={[css({ display: "flex", flexDirection: "column", marginBottom: 20 })]}>
						<p mix={[css({ margin: 0, fontSize: "0.875rem", fontWeight: 600 })]}>
							{t("monitors.label")}
						</p>
						<p
							mix={[
								css({
									margin: "4px 0 8px",
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{t("monitors.description")}
						</p>
						{selectableMonitors.map((monitor) => (
							<label
								key={`${monitor.fieldName}-${monitor.id}`}
								mix={[
									css({
										display: "flex",
										alignItems: "center",
										gap: 8,
										marginBottom: 16,
										fontSize: "0.875rem",
									}),
								]}
							>
								<input
									type="checkbox"
									name={monitor.fieldName}
									value={monitor.id}
									defaultChecked={monitor.checked}
								/>
								<span>{monitor.name}</span>
							</label>
						))}
					</div>
				)}

				{cronJobs.length > 0 && (
					<div mix={[css({ display: "flex", flexDirection: "column", marginBottom: 20 })]}>
						<p mix={[css({ margin: 0, fontSize: "0.875rem", fontWeight: 600 })]}>
							{t("cronJobs.label")}
						</p>
						<p
							mix={[
								css({
									margin: "4px 0 8px",
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{t("cronJobs.description")}
						</p>
						{cronJobs.map((cronJob) => (
							<label
								key={cronJob.id}
								mix={[
									css({
										display: "flex",
										alignItems: "center",
										gap: 8,
										marginBottom: 16,
										fontSize: "0.875rem",
									}),
								]}
							>
								<input
									type="checkbox"
									name="cron_job_ids"
									value={cronJob.id}
									defaultChecked={attachedCronJobIds.includes(cronJob.id)}
								/>
								<span>{cronJob.name}</span>
							</label>
						))}
					</div>
				)}
			</>
		);
	};
}
