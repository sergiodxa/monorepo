/**
 * Shared status-page form fields, used by both the new-page and edit-page views:
 * name/slug/title/description/logo, the public/overall-status toggles, and one
 * checkbox fieldset per attachable monitor type (HTTP, DNS, TCP, cron-job). SSL
 * monitors have no fieldset here — see `app/data/status-page.ts`'s docblock for why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
	}
}

/** Renders the page identity fields plus one checkbox fieldset per attachable monitor type (hidden when that type has no monitors), pre-checked from the `attached*Ids` props. */
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
		} = handle.props;

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

				{monitors.length > 0 && (
					<fieldset
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								gap: 4,
								marginBottom: 20,
								fontSize: "0.875rem",
								fontWeight: 500,
							}),
						]}
					>
						<legend>HTTP monitors</legend>
						{monitors.map((monitor) => (
							<label
								key={monitor.id}
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
									name="monitor_ids"
									value={monitor.id}
									defaultChecked={attachedMonitorIds.includes(monitor.id)}
								/>
								<span>{monitor.name}</span>
							</label>
						))}
					</fieldset>
				)}

				{dnsMonitors.length > 0 && (
					<fieldset
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								gap: 4,
								marginBottom: 20,
								fontSize: "0.875rem",
								fontWeight: 500,
							}),
						]}
					>
						<legend>DNS monitors</legend>
						{dnsMonitors.map((monitor) => (
							<label
								key={monitor.id}
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
									name="dns_monitor_ids"
									value={monitor.id}
									defaultChecked={attachedDnsMonitorIds.includes(monitor.id)}
								/>
								<span>{monitor.name}</span>
							</label>
						))}
					</fieldset>
				)}

				{tcpMonitors.length > 0 && (
					<fieldset
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								gap: 4,
								marginBottom: 20,
								fontSize: "0.875rem",
								fontWeight: 500,
							}),
						]}
					>
						<legend>TCP monitors</legend>
						{tcpMonitors.map((monitor) => (
							<label
								key={monitor.id}
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
									name="tcp_monitor_ids"
									value={monitor.id}
									defaultChecked={attachedTcpMonitorIds.includes(monitor.id)}
								/>
								<span>{monitor.name}</span>
							</label>
						))}
					</fieldset>
				)}

				{cronJobs.length > 0 && (
					<fieldset
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								gap: 4,
								marginBottom: 20,
								fontSize: "0.875rem",
								fontWeight: 500,
							}),
						]}
					>
						<legend>Cron jobs</legend>
						{cronJobs.map((monitor) => (
							<label
								key={monitor.id}
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
									value={monitor.id}
									defaultChecked={attachedCronJobIds.includes(monitor.id)}
								/>
								<span>{monitor.name}</span>
							</label>
						))}
					</fieldset>
				)}
			</>
		);
	};
}
