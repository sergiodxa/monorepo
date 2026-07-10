/**
 * Edit HTTP monitor page: general settings form (posts to `update-monitor`), the
 * content-checks section, and the SSL monitoring settings form. It exists so a team
 * can adjust an existing monitor's configuration and checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor, SelectMonitorContentCheck } from "~/database/schema";

import ContentChecksSection from "~/resources/views/monitors/content-checks";
import MonitorFormFields from "~/resources/views/monitors/form";
import SslForm from "~/resources/views/monitors/ssl-form";
import routes from "~/routes/web";

namespace EditMonitorView {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		contentChecks: SelectMonitorContentCheck[];
	}
}

export default function EditMonitorView(handle: Handle<EditMonitorView.Props>) {
	return () => {
		let { team, monitor, contentChecks } = handle.props;

		return (
			<div>
				<h1 mix={[css({ margin: "0 0 24px" })]}>Edit monitor</h1>
				<form method="post" action={routes.actions.updateMonitor.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<MonitorFormFields monitor={monitor} />
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
						Save changes
					</button>
				</form>

				<ContentChecksSection team={team} monitorId={monitor.id} contentChecks={contentChecks} />

				<SslForm team={team} monitor={monitor} />
			</div>
		);
	};
}
