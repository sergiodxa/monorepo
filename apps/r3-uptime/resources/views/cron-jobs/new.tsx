/**
 * New cron-job monitor form page. Posts to the `create-cron-job` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import CronJobFormFields from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

namespace NewCronJobView {
	export interface Props {
		team: { slug: string };
	}
}

const neutral = {
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

export default function NewCronJobView(handle: Handle<NewCronJobView.Props>) {
	return () => (
		<div>
			<form
				method="post"
				action={routes.actions.createCronJob.href({ team: handle.props.team.slug })}
			>
				<CronJobFormFields />
				<button
					type="submit"
					mix={[
						css({
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							padding: "8px 16px",
							borderRadius: 6,
							border: "1px solid transparent",
							background: neutral[900],
							color: "#ffffff",
							fontFamily: "inherit",
							fontSize: "0.875rem",
							fontWeight: 500,
							cursor: "pointer",
							textDecoration: "none",
							"&:hover": { background: neutral[800] },
						}),
					]}
				>
					Create cron job monitor
				</button>
			</form>
		</div>
	);
}
