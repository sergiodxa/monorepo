/**
 * Signed-in app shell: the sidebar (team switcher, nav by task, the person at the foot), the
 * screen's page header and the one toast stack, around what every `/app/:team/*` page composes.
 * The sidebar's collapsed state comes from its cookie, so the first paint is the width it was left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";
import type { getContext as GetContext } from "remix/middleware/async-context";

import {
	ActivityIcon,
	BellIcon,
	BookOpenIcon,
	CheckIcon,
	ClockIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	GlobeIcon,
	HistoryIcon,
	KeyboardIcon,
	KeyIcon,
	MonitorCogIcon,
	NetworkIcon,
	PlusIcon,
	SettingsIcon,
	UserIcon,
	UsersIcon,
	WorkflowIcon,
	WrenchIcon,
} from "@sdxc/icons";
import { grow, hstack, justify } from "@sdxc/u/layout";
import { truncate } from "@sdxc/u/typography";
import { Button, Menu } from "@sdxc/ui";
import { AppShell as Shell, readAppShellCookie } from "@sdxc/ui/app/app-shell";
import { CommandPalette } from "@sdxc/ui/app/command-palette";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Toasts } from "@sdxc/ui/app/toasts";
import { menuKeys } from "@sdxc/ui/mixins";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { Session } from "remix/session";

import type { AppShellData } from "~/app/http/middleware/app-shell-data";

import { withPrefix } from "~/app/services/prefixed-translate";
import { teamLogoUrl } from "~/app/services/team-logo";
import Avatar from "~/resources/components/avatar";
import BillingBanner from "~/resources/components/billing-banner";
import Logo from "~/resources/components/logo";
import routes from "~/routes/web";

namespace AppShell {
	export interface Props {
		team: { id: string; slug: string; name: string; logo: string | null };
		teams: Array<{ id: string; slug: string; name: string; logo: string | null }>;
		viewer: { name: string; email: string; avatar: string };
		isAdmin: boolean;
		intl: ReturnType<typeof GetContext>["intl"];
		/** The screen's title, drawn as the page header's heading and the trail's last step. */
		heading: string;
		/** The trail from the dashboard down to, and excluding, this screen. */
		breadcrumbs?: Array<{ label: string; href?: string }>;
		/** The request path, which marks the nav row for this screen and its children. */
		currentPath?: string;
		/** Secondary actions, drawn before {@link AppShell.Props.primaryAction}. */
		actions?: RemixNode;
		/** The screen's one primary action, drawn last in the header. */
		primaryAction?: RemixNode;
		/** An overflow menu's trigger and menu, drawn before the secondary actions. */
		overflow?: RemixNode;
		/** One line under the title. */
		description?: RemixNode;
		/** A badge after the title, such as a monitor's status. */
		status?: RemixNode;
		/** Views of one record, each a URL. */
		tabs?: PageHeader.Tab[];
		/** The tabs landmark's name, required whenever {@link AppShell.Props.tabs} is set. */
		tabsLabel?: string;
		/** A notice above the screen that needs resolving, such as a billing problem. */
		banner?: RemixNode;
		/**
		 * The attention counts and billing state; read from `ctx.shell` when unset, and `null`
		 * draws the shell without them.
		 */
		data?: AppShellData | null;
		/** Draws the sidebar as the icon rail; read from its cookie on the request when unset. */
		collapsed?: boolean;
		/**
		 * The session flash from the action that redirected here, shown as one toast; read from the
		 * request's session when a screen passes none.
		 */
		toast?: { intent: "success" | "error"; message: string };
		children: RemixNode;
	}
}

/** The `toast` flash every action sets before it redirects to a signed-in screen. */
const TOAST_FLASH = s.object({
	intent: s.enum_(["success", "error"]),
	message: s.string(),
});

/**
 * Reads the request's `toast` flash, which the session drops once this request ends; a flash of any other shape reads as none,
 * since the session arrives from a cookie.
 */
function sessionFlash(): AppShell.Props["toast"] {
	let parsed = s.parseSafe(TOAST_FLASH, getContext().get(Session)?.get("toast"));
	return parsed.success ? parsed.value : undefined;
}

/** The command palette's dialog id, which the top bar's trigger names. */
const PALETTE_ID = "app-palette";

/** The keyboard help sheet's dialog id, which the top bar's button names. */
const HELP_ID = "app-keys";

/** One sidebar destination. */
interface NavItem {
	href: string;
	label: string;
	icon: RemixNode;
	target?: "_blank";
	/** The `g`+letter sequence the command palette binds to this destination. */
	shortcut?: string;
	/** Monitors of this kind that need attention, drawn as a danger count. */
	count?: number;
}

/**
 * Renders the signed-in frame and the screen's header. A screen passes its title, trail and
 * actions here instead of drawing its own header, so every screen reads the same way.
 */
export default function AppShell(handle: Handle<AppShell.Props>) {
	return () => {
		let {
			team,
			teams,
			viewer,
			isAdmin,
			intl,
			heading,
			breadcrumbs,
			currentPath,
			actions,
			primaryAction,
			overflow,
			description,
			status,
			tabs,
			tabsLabel,
			banner,
			toast,
			children,
		} = handle.props;

		let t = withPrefix(intl.t, "app.layout");
		let collapsed =
			handle.props.collapsed ?? readAppShellCookie(getContext().request.headers.get("Cookie"));
		let shellData = handle.props.data === undefined ? getContext().shell : handle.props.data;
		let attention = shellData?.attention;
		let dashboardHref = routes.app.team.dashboard.index.href({ team: team.slug });
		let teamParams = { team: team.slug };

		/** A row is current on its own page and stays marked on the pages under it. */
		function isCurrent(href: string): boolean {
			if (currentPath === undefined) return false;
			if (currentPath === href) return true;
			return href !== dashboardHref && currentPath.startsWith(`${href}/`);
		}

		let monitorItems: NavItem[] = [
			{
				href: routes.app.team.monitors.index.href(teamParams),
				shortcut: "g h",
				count: attention?.http,
				label: t("sidebar.navigation.items.httpMonitors"),
				icon: <MonitorCogIcon />,
			},
			{
				href: routes.app.team.dnsMonitors.index.href(teamParams),
				shortcut: "g n",
				count: attention?.dns,
				label: t("sidebar.navigation.items.dnsMonitors"),
				icon: <GlobeIcon />,
			},
			{
				href: routes.app.team.tcpMonitors.index.href(teamParams),
				shortcut: "g t",
				count: attention?.tcp,
				label: t("sidebar.navigation.items.tcpMonitors"),
				icon: <NetworkIcon />,
			},
			{
				href: routes.app.team.flowMonitors.index.href(teamParams),
				shortcut: "g f",
				count: attention?.flow,
				label: t("sidebar.navigation.items.flowMonitors"),
				icon: <WorkflowIcon />,
			},
			{
				href: routes.app.team.cronJobs.index.href(teamParams),
				shortcut: "g c",
				count: attention?.cron,
				label: t("sidebar.navigation.items.cronJobs"),
				icon: <ClockIcon />,
			},
		];

		let respondItems: NavItem[] = [
			{
				href: routes.app.team.alerts.index.href(teamParams),
				shortcut: "g a",
				label: t("sidebar.navigation.items.alerts"),
				icon: <BellIcon />,
			},
			{
				href: routes.app.team.maintenanceWindows.index.href(teamParams),
				shortcut: "g w",
				label: t("sidebar.navigation.items.maintenance"),
				icon: <WrenchIcon />,
			},
			{
				href: routes.app.team.statusPages.index.href(teamParams),
				shortcut: "g s",
				label: t("sidebar.navigation.items.statusPages"),
				icon: <FileTextIcon />,
			},
			{
				href: routes.app.team.reports.index.href(teamParams),
				shortcut: "g r",
				label: t("sidebar.navigation.items.reports"),
				icon: <FileSpreadsheetIcon />,
			},
		];

		let teamItems: NavItem[] = isAdmin
			? [
					{
						href: routes.app.team.apiKeys.index.href(teamParams),
						shortcut: "g k",
						label: t("sidebar.navigation.items.apiKeys"),
						icon: <KeyIcon />,
					},
					{
						href: routes.app.team.settings.href(teamParams),
						label: t("sidebar.navigation.items.settings"),
						icon: <SettingsIcon />,
					},
				]
			: [];

		teamItems.push({
			href: routes.docs.index.href(),
			label: t("sidebar.navigation.items.docs"),
			icon: <BookOpenIcon />,
			target: "_blank",
		});

		/** Draws a group's rows, opening an external destination in a new tab. */
		let items = (list: NavItem[]) =>
			list.map((item) => (
				<Shell.Item
					key={item.href}
					href={item.href}
					label={item.label}
					icon={item.icon}
					current={isCurrent(item.href)}
					count={item.count}
					countTone="danger"
					countLabel={item.count ? t("attention", { count: item.count }) : undefined}
					target={item.target}
					rel={item.target ? "noreferrer" : undefined}
				/>
			));

		let teamLogo = <Logo src={teamLogoUrl(team.logo)} name={team.name} />;
		let flashed = toast ?? sessionFlash();
		let flash = flashed
			? [
					{
						id: generateUUID(),
						color: flashed.intent === "success" ? ("success" as const) : ("danger" as const),
						title: flashed.message,
					},
				]
			: [];

		return (
			<Shell
				labels={{
					nav: t("shell.nav"),
					skip: t("shell.skip"),
					menu: t("shell.menu"),
					close: t("shell.close"),
					collapse: t("shell.collapse"),
				}}
				collapsed={collapsed}
				banner={
					banner ??
					(shellData?.billingProblem ? (
						<BillingBanner intl={intl} teamSlug={team.slug} isOwner={shellData.isOwner} />
					) : undefined)
				}
				topbar={
					<div mix={[hstack({ gap: 2 }), grow(), justify("end")]}>
						<CommandPalette.Trigger for={PALETTE_ID}>{t("palette.trigger")}</CommandPalette.Trigger>
						<Button
							variant="ghost"
							color="neutral"
							size="sm"
							commandfor={HELP_ID}
							command="show-modal"
							aria-label={t("help.trigger")}
						>
							<KeyboardIcon size={16} aria-hidden="true" />
						</Button>
					</div>
				}
				workspace={
					teams.length <= 1 ? (
						<Shell.Identity avatar={teamLogo} name={team.name} chevron={false} disabled />
					) : (
						<>
							<Shell.Identity
								avatar={teamLogo}
								name={team.name}
								commandfor="team-picker-menu"
								command="toggle-popover"
								aria-label={t("sidebar.teamPicker.label")}
							/>
							<Menu
								id="team-picker-menu"
								aria-label={t("sidebar.teamPicker.label")}
								mix={[menuKeys()]}
							>
								{teams.map((other) => (
									<Menu.Item
										key={other.id}
										href={routes.app.team.dashboard.index.href({ team: other.slug })}
									>
										<Logo src={teamLogoUrl(other.logo)} name={other.name} />
										<span mix={[truncate()]}>{other.name}</span>
										{other.slug === team.slug && <CheckIcon size={14} strokeWidth={1.5} />}
									</Menu.Item>
								))}
							</Menu>
						</>
					)
				}
				nav={
					<>
						<Shell.Group>
							<Shell.Item
								href={dashboardHref}
								label={t("sidebar.navigation.items.dashboard")}
								icon={<ActivityIcon />}
								current={isCurrent(dashboardHref)}
							/>
						</Shell.Group>
						<Shell.Group title={t("shell.groups.monitors")}>{items(monitorItems)}</Shell.Group>
						<Shell.Group title={t("shell.groups.respond")}>{items(respondItems)}</Shell.Group>
						<Shell.Group title={t("shell.groups.team")}>{items(teamItems)}</Shell.Group>
					</>
				}
				footer={
					<>
						<Shell.Identity
							avatar={<Avatar src={viewer.avatar || null} name={viewer.name} />}
							name={viewer.name}
							detail={viewer.email}
							commandfor="user-menu"
							command="toggle-popover"
							aria-label={t("sidebar.userMenu.label")}
						/>
						<Menu
							id="user-menu"
							placement="top-start"
							aria-label={t("sidebar.userMenu.label")}
							mix={[menuKeys()]}
						>
							<Menu.Item href={routes.app.team.account.href(teamParams)}>
								{t("sidebar.account.title")}
							</Menu.Item>
							<Menu.Item href={routes.logout.index.href()}>
								{t("sidebar.account.signOut")}
							</Menu.Item>
						</Menu>
					</>
				}
			>
				<PageHeader
					title={heading}
					crumbs={breadcrumbs?.length ? [...breadcrumbs, { label: heading }] : undefined}
					crumbsLabel={t("breadcrumbs.label")}
					description={description}
					status={status}
					overflow={overflow}
					actions={actions}
					primaryAction={primaryAction}
					tabs={tabs}
					tabsLabel={tabsLabel}
				/>
				{children}
				<Toasts
					labels={{ region: t("toasts.region"), dismiss: t("toasts.dismiss") }}
					initial={flash}
				/>
				<CommandPalette
					id={PALETTE_ID}
					remember="uptime:palette"
					labels={{
						title: t("palette.title"),
						open: t("palette.open"),
						placeholder: t("palette.placeholder"),
						recent: t("palette.recent"),
						noResults: t("palette.noResults"),
						noResultsHint: t("palette.noResultsHint"),
						results: t("palette.results"),
						back: t("palette.back"),
						close: t("palette.close"),
					}}
				>
					<CommandPalette.Group heading={t("palette.groups.navigate")}>
						{[
							{
								href: dashboardHref,
								label: t("sidebar.navigation.items.dashboard"),
								icon: <ActivityIcon />,
								shortcut: "g d",
							},
							...monitorItems,
							{
								href: routes.app.team.alerts.history.href(teamParams),
								label: t("palette.alertHistory"),
								icon: <HistoryIcon />,
								shortcut: "g i",
							},
							...respondItems,
							...teamItems.filter((item) => item.target === undefined),
							{
								href: routes.app.team.account.href(teamParams),
								label: t("sidebar.account.title"),
								icon: <UserIcon />,
							},
						].map((item) => (
							<CommandPalette.Item
								key={item.href}
								id={`go:${item.href}`}
								title={item.label}
								href={item.href}
								icon={item.icon}
								shortcut={item.shortcut}
							/>
						))}
					</CommandPalette.Group>
					<CommandPalette.Group heading={t("palette.groups.create")}>
						{[
							[routes.app.team.monitors.new.href(teamParams), t("palette.create.http")],
							[routes.app.team.dnsMonitors.new.href(teamParams), t("palette.create.dns")],
							[routes.app.team.tcpMonitors.new.href(teamParams), t("palette.create.tcp")],
							[routes.app.team.flowMonitors.new.href(teamParams), t("palette.create.flow")],
							[routes.app.team.cronJobs.new.href(teamParams), t("palette.create.cron")],
							[routes.app.team.alerts.new.href(teamParams), t("palette.create.alert")],
							[routes.app.team.statusPages.new.href(teamParams), t("palette.create.statusPage")],
							[
								routes.app.team.maintenanceWindows.new.href(teamParams),
								t("palette.create.maintenance"),
							],
						].map(([href, title]) => (
							<CommandPalette.Item
								key={href}
								id={`create:${href}`}
								title={title!}
								href={href}
								icon={<PlusIcon />}
							/>
						))}
					</CommandPalette.Group>
					{teams.length > 1 ? (
						<>
							<CommandPalette.Group heading={t("palette.groups.team")}>
								<CommandPalette.Item
									id="switch-team"
									title={t("palette.switchTeam")}
									page="teams"
									icon={<UsersIcon />}
								/>
							</CommandPalette.Group>
							<CommandPalette.Page
								id="teams"
								title={t("palette.switchTeam")}
								placeholder={t("palette.switchTeamPlaceholder")}
							>
								{teams.map((other) => (
									<CommandPalette.Item
										key={other.id}
										id={`team:${other.slug}`}
										title={other.name}
										href={routes.app.team.dashboard.index.href({ team: other.slug })}
									/>
								))}
							</CommandPalette.Page>
						</>
					) : null}
				</CommandPalette>
				<KeyboardHelp
					id={HELP_ID}
					labels={{
						title: t("help.title"),
						description: t("help.description"),
						close: t("help.close"),
						or: t("help.or"),
						open: t("help.open"),
						general: t("help.general"),
						other: t("help.other"),
					}}
				/>
			</Shell>
		);
	};
}
