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

import {
	Checkbox,
	CheckboxGroup,
	Description,
	Label,
	Switch,
	TextArea,
	TextField,
} from "@pkg/r3-ui";
import { fieldStackLayout } from "@pkg/r3-ui/styles";
import { vstack } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";

import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectStatusPage,
	SelectTcpMonitor,
} from "~/database/schema";

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
		let monitorsLabelId = `${handle.id}-monitors-label`;
		let cronJobsLabelId = `${handle.id}-cron-jobs-label`;
		let descriptionFieldId = `${handle.id}-description`;

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
				<TextField
					label={t("name.label")}
					type="text"
					name="name"
					required
					placeholder={t("name.placeholder")}
					description={t("name.description")}
					defaultValue={page?.name}
					mix={mbe("28px")}
				/>

				<TextField
					label={t("slug.label")}
					type="text"
					name="slug"
					required
					placeholder={t("slug.placeholder")}
					description={t("slug.description")}
					defaultValue={page?.slug}
					mix={mbe("28px")}
				/>

				<TextField
					label={t("title.label")}
					type="text"
					name="title"
					required
					placeholder={t("title.placeholder")}
					description={t("title.description")}
					defaultValue={page?.title}
					mix={mbe("28px")}
				/>

				<div mix={[fieldStackLayout(), mbe("28px")]}>
					<Label htmlFor={descriptionFieldId}>{t("description.label")}</Label>
					<TextArea
						id={descriptionFieldId}
						name="description"
						placeholder={t("description.placeholder")}
						defaultValue={page?.description ?? ""}
					/>
					<Description>{t("description.description")}</Description>
				</div>

				<TextField
					label={t("logoUrl.label")}
					type="url"
					name="logo_url"
					placeholder={t("logoUrl.placeholder")}
					description={t("logoUrl.description")}
					defaultValue={page?.logo_url ?? ""}
					mix={mbe("28px")}
				/>

				<div mix={[fieldStackLayout(), mbe("16px")]}>
					<Switch name="is_public" value="true" defaultChecked={page?.is_public ?? true}>
						{t("isPublic.label")}
					</Switch>
					<Description>{t("isPublic.description")}</Description>
				</div>

				<div mix={[fieldStackLayout(), mbe("16px")]}>
					<Switch
						name="show_overall_status"
						value="true"
						defaultChecked={page?.show_overall_status ?? true}
					>
						{t("showOverallStatus.label")}
					</Switch>
					<Description>{t("showOverallStatus.description")}</Description>
				</div>

				{selectableMonitors.length > 0 && (
					<div mix={[vstack({ gap: "8px" }), mbe("20px")]}>
						<CheckboxGroup aria-labelledby={monitorsLabelId}>
							<Label id={monitorsLabelId}>{t("monitors.label")}</Label>
							{selectableMonitors.map((monitor) => (
								<Checkbox
									key={`${monitor.fieldName}-${monitor.id}`}
									name={monitor.fieldName}
									value={monitor.id}
									defaultChecked={monitor.checked}
								>
									{monitor.name}
								</Checkbox>
							))}
						</CheckboxGroup>
						<Description>{t("monitors.description")}</Description>
					</div>
				)}

				{cronJobs.length > 0 && (
					<div mix={[vstack({ gap: "8px" }), mbe("20px")]}>
						<CheckboxGroup aria-labelledby={cronJobsLabelId}>
							<Label id={cronJobsLabelId}>{t("cronJobs.label")}</Label>
							{cronJobs.map((cronJob) => (
								<Checkbox
									key={cronJob.id}
									name="cron_job_ids"
									value={cronJob.id}
									defaultChecked={attachedCronJobIds.includes(cronJob.id)}
								>
									{cronJob.name}
								</Checkbox>
							))}
						</CheckboxGroup>
						<Description>{t("cronJobs.description")}</Description>
					</div>
				)}
			</>
		);
	};
}
