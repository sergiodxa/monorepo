/**
 * New HTTP monitor form page controller. Posts to the `create-monitor` action;
 * requires `requireUser` + `requireTeam`.
 *
 * Fields are grouped into two bordered cards — what gets watched, how it gets
 * checked — inside one `<form>`, with the submit control at the last card's foot.
 *
 * A `?url=` pre-fill lets the rest of the app hand this form a URL to watch
 * already filled in; it only seeds the field, since the monitor is still
 * created by the `POST`, so a link, a crawler, or a reload creates nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@pkg/u/layout";
import { Button } from "@pkg/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

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

/** GET /app/:team/monitors/new — the new monitor form. */
export default createAction(routes.app.team.monitors.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let prefill = ctx.url.searchParams.get(MONITOR_URL_PREFILL)?.slice(0, MAX_PREFILL_LENGTH);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.createMonitor.header.title")}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.http.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 12 })]}
						>
							<SettingsSection
								id="basics"
								title={ctx.i18next.t("page.createMonitor.form.sections.basics.title")}
								description={ctx.i18next.t("page.createMonitor.form.sections.basics.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<MonitorFormFields
											i18next={ctx.i18next}
											page="createMonitor"
											group="basics"
											defaultUrl={prefill}
										/>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="checks"
								title={ctx.i18next.t("page.createMonitor.form.sections.checks.title")}
								description={ctx.i18next.t("page.createMonitor.form.sections.checks.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<MonitorFormFields i18next={ctx.i18next} page="createMonitor" group="checks" />
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.i18next.t("page.createMonitor.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
