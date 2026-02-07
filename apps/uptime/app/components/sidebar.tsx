import { Sidebar } from "@pkg/ui";
import { ActivityIcon, BellIcon, MonitorCogIcon, PlusIcon, SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useMatch } from "react-router";

import { TeamPicker } from "~/components/team-picker";
import { UserMenu } from "~/components/user-menu";

export function AppSidebar(props: {
	team: { id: string; slug: string; name: string; logo: string | null };
	teams: Array<{
		id: string;
		slug: string;
		name: string;
		logo: string | null;
	}>;
	viewer: {
		id: string;
		avatar: string;
		name: string;
		email: string;
		isAdmin: boolean;
	};
	monitors: Array<{ id: string; name: string; status: "up" | "down" | "unknown" }>;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar",
	});

	let dashboardPath = href("/app/:team/dashboard", { team: props.team.slug });
	let alertsPath = href("/app/:team/alerts", { team: props.team.slug });
	let settingsPath = href("/app/:team/settings", { team: props.team.slug });

	let isDashboardActive = useMatch("/app/:team/dashboard") !== null;
	let isAlertsActive = useMatch("/app/:team/alerts") !== null;
	let isSettingsActive = useMatch("/app/:team/settings") !== null;

	let isAdmin = props.viewer.isAdmin;

	return (
		<Sidebar>
			<Sidebar.Header>
				<TeamPicker active={props.team} teams={props.teams} />
			</Sidebar.Header>

			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={dashboardPath}
									active={isDashboardActive}
									tooltip={t("navigation.items.dashboard")}
								>
									<ActivityIcon size={16} />
									<span>{t("navigation.items.dashboard")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={alertsPath}
									active={isAlertsActive}
									tooltip={t("navigation.items.alerts")}
								>
									<BellIcon size={16} />
									<span>{t("navigation.items.alerts")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				{props.monitors.length > 0 && (
					<>
						<Sidebar.Group>
							<Sidebar.GroupLabel>
								<span>{t("navigation.items.monitors")}</span>
								<Link
									to={href("/app/:team/monitors/new", { team: props.team.slug })}
									className="ui-sidebar-group-action"
								>
									<PlusIcon size={14} />
								</Link>
							</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									{props.monitors.map((monitor) => (
										<MonitorMenuItem
											key={monitor.id}
											monitor={monitor}
											teamSlug={props.team.slug}
										/>
									))}
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</>
				)}

				{isAdmin && (
					<Sidebar.Menu className="mt-auto">
						<Sidebar.MenuItem>
							<Sidebar.MenuLink
								href={settingsPath}
								active={isSettingsActive}
								tooltip={t("navigation.items.settings")}
							>
								<SettingsIcon size={16} />
								<span>{t("navigation.items.settings")}</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				)}
			</Sidebar.Content>

			<Sidebar.Footer>
				<UserMenu user={props.viewer} />
			</Sidebar.Footer>
		</Sidebar>
	);
}

function MonitorMenuItem(props: {
	monitor: { id: string; name: string; status: "up" | "down" | "unknown" };
	teamSlug: string;
}) {
	let monitorPath = href("/app/:team/monitors/:monitorId", {
		team: props.teamSlug,
		monitorId: props.monitor.id,
	});
	let isActive = useMatch("/app/:team/monitors/:monitorId") !== null;

	return (
		<Sidebar.MenuItem>
			<Sidebar.MenuLink href={monitorPath} active={isActive} tooltip={props.monitor.name}>
				<MonitorCogIcon size={16} />
				<span>{props.monitor.name}</span>
				<StatusIndicator status={props.monitor.status} />
			</Sidebar.MenuLink>
		</Sidebar.MenuItem>
	);
}

function StatusIndicator(props: { status: "up" | "down" | "unknown" }) {
	let colorClass = {
		up: "bg-green-500",
		down: "bg-red-500",
		unknown: "bg-neutral-400",
	}[props.status];

	return <span className={`ml-auto size-2 shrink-0 rounded-full ${colorClass}`} />;
}
