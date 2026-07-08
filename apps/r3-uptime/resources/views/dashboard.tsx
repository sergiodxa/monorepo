/**
 * Dashboard placeholder view for the signed-in team area. Renders inside the app
 * shell and currently shows an empty state — monitor stat cards and tables land in
 * Phase 2. It exists as the landing page a team is redirected to after `/app/:team`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";

namespace DashboardView {
	export interface Props {
		teamName: string;
	}
}

export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => (
		<div mix={[s.emptyState]}>
			<h1>{handle.props.teamName}</h1>
			<p mix={[s.mutedSmall]}>
				No monitors yet. HTTP, DNS, TCP, and cron-job monitoring land in a later phase of this port.
			</p>
		</div>
	);
}
