/**
 * New cron-job monitor page controller. Requires `requireUser` + `requireTeam`. The page also
 * renders from the create action after a rejected submit, carrying what was typed and the
 * issues, so a mistake costs one correction rather than the whole form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { CronJobFormState } from "~/resources/views/cron-jobs/form";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { withPrefix } from "~/app/services/prefixed-translate";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import CronJobForm, { NEW_CRON_JOB_VALUES } from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

/**
 * Renders the new cron-job page for the current request, empty or holding a rejected submit.
 * A rejected submit answers 400, so the browser keeps the action's URL and its history entry.
 *
 * @param state - What was submitted and why it was refused; omitted for a fresh form.
 */
export function renderNewCronJobPage(state?: CronJobFormState): Response | Promise<Response> {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let t = withPrefix(ctx.intl.t, "page.createCronJob");

	return ctx.render(
		<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${t("header.title")}`}>
			<AppShell
				team={ctx.team}
				currentPath={ctx.url.pathname}
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
						values={state?.values ?? NEW_CRON_JOB_VALUES}
						issues={state?.issues}
						page="createCronJob"
						intl={ctx.intl}
						footer={<Button type="submit">{t("form.cta")}</Button>}
					/>
				</FormPage>
			</AppShell>
		</DocumentLayout>,
		{ status: state === undefined ? 200 : 400 },
	);
}

/** GET /app/:team/cron-jobs/new — the new cron-job monitor form. */
export default createAction(routes.app.team.cronJobs.new, {
	middleware: [requireUser, requireTeam],
	handler: () => renderNewCronJobPage(),
});
