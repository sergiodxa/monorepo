/**
 * New alert form page. Posts to the `create-alert` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import { neutral } from "~/resources/theme";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

namespace NewAlertView {
	export interface Props {
		team: { slug: string };
		monitors: SelectMonitor[];
	}
}

export default function NewAlertView(handle: Handle<NewAlertView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<form method="post" action={routes.actions.createAlert.href({ team: team.slug })}>
					<AlertFormFields monitors={monitors} />
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
						Create alert
					</button>
				</form>
			</div>
		);
	};
}
