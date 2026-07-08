/**
 * New cron-job monitor form page. Posts to the `create-cron-job` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import CronJobFormFields from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

namespace NewCronJobView {
	export interface Props {
		team: { slug: string };
	}
}

export default function NewCronJobView(handle: Handle<NewCronJobView.Props>) {
	return () => (
		<div>
			<h1>New cron job monitor</h1>
			<form
				method="post"
				action={routes.actions.createCronJob.href({ team: handle.props.team.slug })}
			>
				<CronJobFormFields />
				<button type="submit" mix={[s.buttonPrimary]}>
					Create cron job monitor
				</button>
			</form>
		</div>
	);
}
