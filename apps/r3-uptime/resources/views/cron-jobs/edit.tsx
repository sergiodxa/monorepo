/**
 * Edit cron-job monitor page: settings form, posting to `update-cron-job`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectCronJobMonitor } from "~/database/schema";

import Button from "~/resources/components/button";
import { neutral, primary } from "~/resources/theme";
import CronJobFormFields from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

const cancelLink = css({
	color: primary[600],
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
	"@media (prefers-color-scheme: dark)": { color: primary[400] },
});

const dialog = css({
	padding: 24,
	borderRadius: 8,
	border: `1px solid ${neutral[300]}`,
	maxWidth: 400,
	"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[900],
		color: neutral[50],
	},
});

const dialogText = css({
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

namespace EditCronJobView {
	export interface Props {
		team: { slug: string };
		monitor: SelectCronJobMonitor;
	}
}

/** Renders the cron-job form pre-filled with the current values, plus a delete-confirmation dialog that warns ping history is deleted too. */
export default function EditCronJobView(handle: Handle<EditCronJobView.Props>) {
	return () => {
		let { team, monitor } = handle.props;

		return (
			<div>
				<form method="post" action={routes.actions.cronJob.update.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<CronJobFormFields monitor={monitor} />
					<Button type="submit">Save changes</Button>
				</form>

				<a
					href={routes.app.team.cronJobs.show.href({ team: team.slug, monitorId: monitor.id })}
					mix={[cancelLink]}
				>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<Button type="button" color="danger" commandfor="delete-cron-job" command="show-modal">
					Delete monitor
				</Button>
				<dialog id="delete-cron-job" mix={[dialog]}>
					<h3>Delete this cron job monitor?</h3>
					<p mix={[dialogText]}>This also deletes its ping history. This can't be undone.</p>
					<form method="post" action={routes.actions.cronJob.delete.href({ team: team.slug })}>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<Button type="button" variant="outline" commandfor="delete-cron-job" command="close">
							Cancel
						</Button>
						<Button type="submit" color="danger">
							Delete
						</Button>
					</form>
				</dialog>
			</div>
		);
	};
}
