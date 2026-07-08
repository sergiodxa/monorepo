/**
 * Signed-in app shell layout: header (logo, team name, viewer email, sign-out link),
 * a sidebar navigation column, the page's main content, and an optional flash toast.
 * Every `/app/:team/*` page composes its content into this shell. It exists as the
 * shared frame every team-area page renders inside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace AppShell {
	export interface Props {
		team: { slug: string; name: string };
		viewer: { name: string; email: string };
		toast?: { intent: "success" | "error"; message: string };
		children: RemixNode;
	}
}

export default function AppShell(handle: Handle<AppShell.Props>) {
	return () => {
		let { team, viewer, toast, children } = handle.props;

		return (
			<div mix={[s.page]}>
				<header mix={[s.header]}>
					<div mix={[s.row]}>
						<strong>Uptime</strong>
						<span mix={[s.mutedSmall]}>{team.name}</span>
					</div>
					<div mix={[s.row]}>
						<span mix={[s.mutedSmall]}>{viewer.email}</span>
						<a href={routes.logout.index.href()} mix={[s.link]}>
							Sign out
						</a>
					</div>
				</header>

				<div mix={[s.shellBody]}>
					<nav mix={[s.sidebar]}>
						<ul mix={[s.navList]}>
							<li>
								<a href={routes.app.team.dashboard.href({ team: team.slug })} mix={[s.link]}>
									Dashboard
								</a>
							</li>
							<li>
								<a href={routes.app.team.alerts.href({ team: team.slug })} mix={[s.link]}>
									Alerts
								</a>
							</li>
							<li>
								<a
									href={routes.app.team.maintenanceWindows.href({ team: team.slug })}
									mix={[s.link]}
								>
									Maintenance
								</a>
							</li>
						</ul>
					</nav>

					<main mix={[s.main]}>{children}</main>
				</div>

				{toast && <p mix={[s.toast]}>{toast.message}</p>}
			</div>
		);
	};
}
