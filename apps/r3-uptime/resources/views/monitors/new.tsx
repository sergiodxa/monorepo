/**
 * New HTTP monitor form page. Posts to the `create-monitor` action. It exists as the
 * page a team uses to start monitoring a new URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

namespace NewMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

export default function NewMonitorView(handle: Handle<NewMonitorView.Props>) {
	return () => (
		<div mix={[css({ maxWidth: 640 })]}>
			<form
				method="post"
				action={routes.actions.monitor.http.create.href({ team: handle.props.team.slug })}
			>
				<MonitorFormFields />
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
							background: "oklch(0.24 0.005 145)",
							color: "#ffffff",
							fontFamily: "inherit",
							fontSize: "0.875rem",
							fontWeight: 500,
							cursor: "pointer",
							textDecoration: "none",
							"&:hover": { background: "oklch(0.32 0.006 145)" },
						}),
					]}
				>
					Create monitor
				</button>
			</form>
		</div>
	);
}
