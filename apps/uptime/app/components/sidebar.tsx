import { Sidebar } from "@pkg/ui";
import {
	ActivityIcon,
	BellIcon,
	ClockIcon,
	FileTextIcon,
	GlobeIcon,
	KeyIcon,
	MonitorCogIcon,
	NetworkIcon,
	SettingsIcon,
	WrenchIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, useMatch } from "react-router";

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
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar",
	});

	let dashboardPath = href("/app/:team/dashboard", { team: props.team.slug });
	let alertsPath = href("/app/:team/alerts", { team: props.team.slug });
	let maintenancePath = href("/app/:team/maintenance", { team: props.team.slug });
	let statusPagesPath = href("/app/:team/status-pages", { team: props.team.slug });
	let httpMonitorsPath = href("/app/:team/http", { team: props.team.slug });
	let dnsMonitorsPath = href("/app/:team/dns", { team: props.team.slug });
	let tcpMonitorsPath = href("/app/:team/tcp", { team: props.team.slug });
	let cronJobsPath = href("/app/:team/cron-jobs", { team: props.team.slug });
	let settingsPath = href("/app/:team/settings", { team: props.team.slug });
	let apiKeysPath = href("/app/:team/api-keys", { team: props.team.slug });

	let isDashboardActive = useMatch("/app/:team/dashboard") !== null;
	let isAlertsActive = useMatch("/app/:team/alerts") !== null;
	let isMaintenanceActive = useMatch("/app/:team/maintenance/*") !== null;
	let isStatusPagesActive = useMatch("/app/:team/status-pages/*") !== null;
	let isHttpMonitorsActive = useMatch("/app/:team/http/*") !== null;
	let isDnsMonitorsActive = useMatch("/app/:team/dns/*") !== null;
	let isTcpMonitorsActive = useMatch("/app/:team/tcp/*") !== null;
	let isCronJobsActive = useMatch("/app/:team/cron-jobs/*") !== null;
	let isSettingsActive = useMatch("/app/:team/settings") !== null;
	let isApiKeysActive = useMatch("/app/:team/api-keys") !== null;

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
									href={httpMonitorsPath}
									active={isHttpMonitorsActive}
									tooltip={t("navigation.items.httpMonitors")}
								>
									<MonitorCogIcon size={16} />
									<span>{t("navigation.items.httpMonitors")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={dnsMonitorsPath}
									active={isDnsMonitorsActive}
									tooltip={t("navigation.items.dnsMonitors")}
								>
									<GlobeIcon size={16} />
									<span>{t("navigation.items.dnsMonitors")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={tcpMonitorsPath}
									active={isTcpMonitorsActive}
									tooltip={t("navigation.items.tcpMonitors")}
								>
									<NetworkIcon size={16} />
									<span>{t("navigation.items.tcpMonitors")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={cronJobsPath}
									active={isCronJobsActive}
									tooltip={t("navigation.items.cronJobs")}
								>
									<ClockIcon size={16} />
									<span>{t("navigation.items.cronJobs")}</span>
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
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={maintenancePath}
									active={isMaintenanceActive}
									tooltip={t("navigation.items.maintenance")}
								>
									<WrenchIcon size={16} />
									<span>{t("navigation.items.maintenance")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink
									href={statusPagesPath}
									active={isStatusPagesActive}
									tooltip={t("navigation.items.statusPages")}
								>
									<FileTextIcon size={16} />
									<span>{t("navigation.items.statusPages")}</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				{isAdmin && (
					<Sidebar.Menu className="mt-auto">
						<Sidebar.MenuItem>
							<Sidebar.MenuLink
								href={apiKeysPath}
								active={isApiKeysActive}
								tooltip={t("navigation.items.apiKeys")}
							>
								<KeyIcon size={16} />
								<span>{t("navigation.items.apiKeys")}</span>
							</Sidebar.MenuLink>
						</Sidebar.MenuItem>
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
