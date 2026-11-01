/**
 * The new HTTP monitor page, drawn by the form's GET route and again by the create action when
 * it refuses a submission, so a rejected form comes back holding everything that was typed
 * with an issue beside each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";

import { getViewer } from "~/app/http/middleware/auth";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

export namespace NewMonitorPage {
	export interface Props {
		/** The URL a link handed over through `?url=`, for an empty form. */
		defaultUrl?: string;
		/** The submission the create action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function NewMonitorPage(handle: Handle<NewMonitorPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { defaultUrl, submission } = handle.props;

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.createMonitor.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.monitors.new.href({ team: ctx.team.slug })}
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
											submission={submission}
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
											submission={submission}
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
			</DocumentLayout>
		);
	};
}
