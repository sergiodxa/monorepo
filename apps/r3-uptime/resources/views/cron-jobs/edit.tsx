/**
 * Edit cron-job monitor page: settings form, posting to `update-cron-job`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectCronJobMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import CronJobFormFields from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

namespace EditCronJobView {
	export interface Props {
		team: { slug: string };
		monitor: SelectCronJobMonitor;
	}
}

export default function EditCronJobView(handle: Handle<EditCronJobView.Props>) {
	return () => {
		let { team, monitor } = handle.props;

		return (
			<div>
				<h1>Edit cron job monitor</h1>
				<form method="post" action={routes.actions.updateCronJob.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<CronJobFormFields monitor={monitor} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<a
					href={routes.app.team.cronJobShow.href({ team: team.slug, monitorId: monitor.id })}
					mix={[s.link]}
				>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-cron-job"
					command="show-modal"
					mix={[s.buttonDanger]}
				>
					Delete monitor
				</button>
				<dialog id="delete-cron-job" mix={[s.dialog]}>
					<h3>Delete this cron job monitor?</h3>
					<p mix={[s.mutedSmall]}>This also deletes its ping history. This can't be undone.</p>
					<form method="post" action={routes.actions.deleteCronJob.href({ team: team.slug })}>
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<button
							type="button"
							commandfor="delete-cron-job"
							command="close"
							mix={[s.buttonSecondary]}
						>
							Cancel
						</button>
						<button type="submit" mix={[s.buttonDanger]}>
							Delete
						</button>
					</form>
				</dialog>
			</div>
		);
	};
}
