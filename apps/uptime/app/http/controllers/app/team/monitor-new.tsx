/**
 * New HTTP monitor form page controller. Posts to the `create-monitor` action, which
 * redraws this same page with the submitted values and per-field issues when they fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { MonitorFormErrors, MonitorFormValues } from "~/resources/views/monitors/form";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { MONITOR_URL_PREFILL } from "~/app/http/validators/monitor";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

/**
 * Longest pre-fill accepted from `?url=`. JSX already escapes the echoed
 * value; this only limits how much of somebody else's query string the page
 * renders back to them.
 */
const MAX_PREFILL_LENGTH = 2048;

/** What the new-monitor page draws into its fields: a pre-fill, or a failed submission. */
export interface NewMonitorForm {
	/** The URL a link handed over through `?url=`, for an empty form. */
	defaultUrl?: string;
	values?: MonitorFormValues;
	errors?: MonitorFormErrors;
}

/**
 * Renders the new-monitor page for the current request. The create action calls it with the
 * values and issues of a failed submission, so nothing typed is lost on the way back.
 *
 * @param form What to draw into the fields.
 * @param init The response's status and headers, `400` for a failed submission.
 */
export function renderNewMonitorPage(form: NewMonitorForm = {}, init?: ResponseInit) {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let { defaultUrl, values, errors } = form;

	return ctx.render(
		<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · New monitor`}>
			<AppShell
				team={ctx.team}
				currentPath={ctx.url.pathname}
				teams={ctx.teams}
				viewer={viewer}
				isAdmin={ctx.membership.role === "admin"}
				intl={ctx.intl}
				heading={ctx.intl.t("page.createMonitor.header.title")}
				breadcrumbs={[
					{
						label: ctx.intl.t("page.httpMonitors.header.title"),
						href: routes.app.team.monitors.index.href({ team: ctx.team.slug }),
					},
				]}
			>
				<FormPage>
					<form
						method="post"
						action={routes.actions.monitor.http.create.href({ team: ctx.team.slug })}
						mix={[vstack({ gap: 12 })]}
					>
						<SettingsSection
							id="basics"
							title={ctx.intl.t("page.createMonitor.form.sections.basics.title")}
							description={ctx.intl.t("page.createMonitor.form.sections.basics.description")}
						>
							<SettingsSection.Card>
								<SettingsSection.Body>
									<MonitorFormFields
										intl={ctx.intl}
										page="createMonitor"
										group="basics"
										defaultUrl={defaultUrl}
										values={values}
										errors={errors}
									/>
								</SettingsSection.Body>
							</SettingsSection.Card>
						</SettingsSection>

						<SettingsSection
							id="checks"
							title={ctx.intl.t("page.createMonitor.form.sections.checks.title")}
							description={ctx.intl.t("page.createMonitor.form.sections.checks.description")}
						>
							<SettingsSection.Card>
								<SettingsSection.Body>
									<MonitorFormFields
										intl={ctx.intl}
										page="createMonitor"
										group="checks"
										values={values}
										errors={errors}
									/>
								</SettingsSection.Body>
								<SettingsSection.Footer>
									<Button type="submit">{ctx.intl.t("page.createMonitor.form.cta")}</Button>
								</SettingsSection.Footer>
							</SettingsSection.Card>
						</SettingsSection>
					</form>
				</FormPage>
			</AppShell>
		</DocumentLayout>,
		init,
	);
}

/** GET /app/:team/monitors/new — the new monitor form, its URL pre-filled from `?url=`. */
export default createAction(routes.app.team.monitors.new, {
	middleware: [requireUser, requireTeam],
	handler: (ctx) => {
		let prefill = ctx.url.searchParams.get(MONITOR_URL_PREFILL)?.slice(0, MAX_PREFILL_LENGTH);
		return renderNewMonitorPage({ defaultUrl: prefill });
	},
});
