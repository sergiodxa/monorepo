/**
 * New cron-job monitor form page. Posts to the `create-cron-job` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import Button from "~/resources/components/button";
import CronJobFormFields from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

namespace NewCronJobView {
	export interface Props {
		team: { slug: string };
	}
}

/** Renders the empty cron-job form for creating a new monitor. */
export default function NewCronJobView(handle: Handle<NewCronJobView.Props>) {
	return () => (
		<div>
			<form
				method="post"
				action={routes.actions.cronJob.create.href({ team: handle.props.team.slug })}
			>
				<CronJobFormFields />
				<Button type="submit">Create cron job monitor</Button>
			</form>
		</div>
	);
}
