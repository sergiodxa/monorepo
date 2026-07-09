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
						<button
							type="button"
							commandfor="app-sidebar"
							command="toggle-popover"
							aria-label="Toggle navigation"
							mix={[s.sidebarToggle]}
						>
							<svg viewBox="0 0 20 20" width={18} height={18} fill="none" aria-hidden="true">
								<path
									d="M3 5h14M3 10h14M3 15h14"
									stroke="currentColor"
									strokeWidth={1.5}
									strokeLinecap="round"
								/>
							</svg>
						</button>
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
					<nav id="app-sidebar" popover="auto" mix={[s.sidebar]}>
						<ul mix={[s.navList]}>
							<li>
								<a href={routes.app.team.dashboard.href({ team: team.slug })} mix={[s.navLink]}>
									Dashboard
								</a>
							</li>
							<li>
								<a href={routes.app.team.alerts.href({ team: team.slug })} mix={[s.navLink]}>
									Alerts
								</a>
							</li>
							<li>
								<a
									href={routes.app.team.maintenanceWindows.href({ team: team.slug })}
									mix={[s.navLink]}
								>
									Maintenance
								</a>
							</li>
							<li>
								<a href={routes.app.team.statusPages.href({ team: team.slug })} mix={[s.navLink]}>
									Status pages
								</a>
							</li>
							<li>
								<a href={routes.app.team.apiKeys.href({ team: team.slug })} mix={[s.navLink]}>
									API keys
								</a>
							</li>
							<li>
								<a href={routes.app.team.settings.href({ team: team.slug })} mix={[s.navLink]}>
									Settings
								</a>
							</li>
							<li>
								<a href={routes.app.team.account.href({ team: team.slug })} mix={[s.navLink]}>
									Account
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
