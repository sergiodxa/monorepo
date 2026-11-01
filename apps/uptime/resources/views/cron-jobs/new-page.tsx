/**
 * The new cron-job monitor page, drawn by the form's GET route and again by the create action
 * when it refuses a submission, so a rejected form comes back holding everything that was
 * typed with an issue beside each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Button } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";

import { getViewer } from "~/app/http/middleware/auth";
import { withPrefix } from "~/app/services/prefixed-translate";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import CronJobForm, { NEW_CRON_JOB_VALUES } from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

export namespace NewCronJobPage {
	export interface Props {
		/** The submission the create action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function NewCronJobPage(handle: Handle<NewCronJobPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { submission } = handle.props;

		let t = withPrefix(ctx.intl.t, "page.createCronJob");

		return (
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${t("header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.cronJobs.new.href({ team: ctx.team.slug })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: t("header.breadcrumb.cronJobs"),
							href: routes.app.team.cronJobs.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<CronJobForm
							action={routes.actions.cronJob.create.href({ team: ctx.team.slug })}
							values={NEW_CRON_JOB_VALUES}
							submission={submission}
							page="createCronJob"
							intl={ctx.intl}
							footer={<Button type="submit">{t("form.cta")}</Button>}
						/>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
