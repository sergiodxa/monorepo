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

import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectStatusPage,
	SelectTcpMonitor,
} from "~/database/schema";

import * as s from "~/resources/styles";

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
				<label mix={[s.field]}>
					<span>Name</span>
					<input type="text" name="name" required defaultValue={page?.name} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>Slug</span>
					<input type="text" name="slug" required defaultValue={page?.slug} mix={[s.input]} />
					<p mix={[s.mutedSmall]}>Lowercase letters, numbers, and hyphens only.</p>
				</label>

				<label mix={[s.field]}>
					<span>Title</span>
					<input type="text" name="title" required defaultValue={page?.title} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>Description</span>
					<textarea name="description" defaultValue={page?.description ?? ""} mix={[s.input]} />
				</label>

				<label mix={[s.field]}>
					<span>Logo URL</span>
					<input type="url" name="logo_url" defaultValue={page?.logo_url ?? ""} mix={[s.input]} />
				</label>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="is_public"
						value="true"
						defaultChecked={page?.is_public ?? true}
					/>
					<span>Public — anyone with the link can view this page</span>
				</label>

				<label mix={[s.checkboxField]}>
					<input
						type="checkbox"
						name="show_overall_status"
						value="true"
						defaultChecked={page?.show_overall_status ?? true}
					/>
					<span>Show the overall status banner</span>
				</label>

				{monitors.length > 0 && (
					<fieldset mix={[s.field]}>
						<legend>HTTP monitors</legend>
						{monitors.map((monitor) => (
							<label key={monitor.id} mix={[s.checkboxField]}>
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
					<fieldset mix={[s.field]}>
						<legend>DNS monitors</legend>
						{dnsMonitors.map((monitor) => (
							<label key={monitor.id} mix={[s.checkboxField]}>
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
					<fieldset mix={[s.field]}>
						<legend>TCP monitors</legend>
						{tcpMonitors.map((monitor) => (
							<label key={monitor.id} mix={[s.checkboxField]}>
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
					<fieldset mix={[s.field]}>
						<legend>Cron jobs</legend>
						{cronJobs.map((monitor) => (
							<label key={monitor.id} mix={[s.checkboxField]}>
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
