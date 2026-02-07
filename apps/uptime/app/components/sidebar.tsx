import { Sidebar } from "@pkg/ui";
import {
	ActivityIcon,
	BadgeCheckIcon,
	BellIcon,
	CreditCardIcon,
	MonitorCogIcon,
	PlusIcon,
	UsersIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useMatch } from "react-router";

import { TeamPicker } from "~/components/team-picker";
import { UserMenu } from "~/components/user-menu";
import { useTeam } from "~/hooks/use-team";

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
	monitors: Array<{ id: string; name: string }>;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar",
	});

	let team = useTeam();

	let dashboardPath = href("/app/:team/dashboard", { team: props.team.slug });
	let alertsPath = href("/app/:team/alerts", { team: props.team.slug });
	let checkoutPath = href("/app/:team/checkout", { team: props.team.slug });
	let domainsPath = href("/app/:team/domains", { team: props.team.slug });
	let membersPath = href("/app/:team/members", { team: props.team.slug });

	let isDashboardActive = useMatch("/app/:team/dashboard") !== null;
	let isAlertsActive = useMatch("/app/:team/alerts") !== null;
	let isCheckoutActive = useMatch("/app/:team/checkout") !== null;
	let isDomainsActive = useMatch("/app/:team/domains") !== null;
	let isMembersActive = useMatch("/app/:team/members") !== null;

	let isOwner = team.ownerId === props.viewer.id;
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

				{(isOwner || isAdmin) && (
					<>
						<Sidebar.Group className="mt-auto">
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									{isOwner && (
										<Sidebar.MenuItem>
											<Sidebar.MenuLink
												href={checkoutPath}
												active={isCheckoutActive}
												tooltip={t("navigation.items.billing")}
											>
												<CreditCardIcon size={16} />
												<span>{t("navigation.items.billing")}</span>
											</Sidebar.MenuLink>
										</Sidebar.MenuItem>
									)}
									{isAdmin && (
										<>
											<Sidebar.MenuItem>
												<Sidebar.MenuLink
													href={domainsPath}
													active={isDomainsActive}
													tooltip={t("navigation.items.domains")}
												>
													<BadgeCheckIcon size={16} />
													<span>{t("navigation.items.domains")}</span>
												</Sidebar.MenuLink>
											</Sidebar.MenuItem>
											<Sidebar.MenuItem>
												<Sidebar.MenuLink
													href={membersPath}
													active={isMembersActive}
													tooltip={t("navigation.items.members")}
												>
													<UsersIcon size={16} />
													<span>{t("navigation.items.members")}</span>
												</Sidebar.MenuLink>
											</Sidebar.MenuItem>
										</>
									)}
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</>
				)}
			</Sidebar.Content>

			<Sidebar.Footer>
				<UserMenu user={props.viewer} />
			</Sidebar.Footer>
		</Sidebar>
	);
}

function MonitorMenuItem(props: { monitor: { id: string; name: string }; teamSlug: string }) {
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
			</Sidebar.MenuLink>
		</Sidebar.MenuItem>
	);
}
