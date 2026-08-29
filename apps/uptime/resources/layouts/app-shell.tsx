/**
 * Signed-in app shell: a sidebar (team switcher, nav, admin group, user
 * menu) and a header sit around the content every `/app/:team/*` page
 * composes here. Below 768px the sidebar is a `<nav popover>` off-canvas
 * drawer; at ≥768px that same `<nav>` switches to `display: contents` and
 * its three sections become direct items of a two-column, three-row grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/middleware/async-context";
import type { Handle, RemixNode } from "remix/ui";

import {
	ActivityIcon,
	BellIcon,
	BookOpenIcon,
	CheckIcon,
	ChevronsUpDownIcon,
	ClockIcon,
	FileTextIcon,
	GlobeIcon,
	KeyIcon,
	MonitorCogIcon,
	NetworkIcon,
	PanelLeftIcon,
	SettingsIcon,
	WorkflowIcon,
	WrenchIcon,
} from "@pkg/lucide-remix";
import { bg, border, borderEdge, fg } from "@pkg/u/color";
import { rounded, shadow } from "@pkg/u/effects";
import { combine, cursor, listStyle, raw } from "@pkg/u/general";
import {
	basis,
	fixed,
	flex,
	flexCol,
	gap,
	grid,
	gridArea,
	grow,
	hidden,
	inlineFlex,
	insBottom,
	insLeft,
	insTop,
	items,
	justify,
	shrink,
} from "@pkg/u/layout";
import { boxSizing } from "@pkg/u/layout";
import { overflow, overflowY } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, height, is, m, maxBs, mbs, minBs, minIs, p, pi } from "@pkg/u/size";
import { hover, when } from "@pkg/u/state";
import { fontSize, textAlign, truncate, weight } from "@pkg/u/typography";
import { Breadcrumbs, Menu, Sidebar } from "@pkg/ui";
import { menuKeys } from "@pkg/ui/mixins";

import AppToaster from "~/resources/components/app-toaster";
import Avatar from "~/resources/components/avatar";
import FlashToast from "~/resources/components/flash-toast";
import Logo from "~/resources/components/logo";
import routes from "~/routes/web";

/**
 * The page shell: a plain flex column below 768px, where the sidebar
 * `<nav>` is either closed or an off-canvas overlay; at ≥768px it becomes
 * the two-column, three-row grid described in the file docblock.
 */
const page = combine([
	flex(),
	flexCol(),
	height("100vh"),
	overflow(),
	media("(min-width: 768px)", [
		grid(),
		raw({
			gridTemplateColumns: "256px 1fr",
			gridTemplateRows: "auto 1fr auto",
			gridTemplateAreas: `"teampicker header" "nav content" "usermenu content"`,
		}),
	]),
]);

/** Horizontal group of inline items (nav toggle + breadcrumb, action buttons). */
const row = combine([flex(), items("center"), gap(3), minIs(0)]);

/**
 * The hamburger button that opens the sidebar on mobile via the native Command
 * Invoker API (`commandfor`/`command="toggle-popover"`). Hidden at ≥768px, where the
 * sidebar is always visible and a toggle would be redundant.
 */
const sidebarToggle = combine([
	inlineFlex(),
	items("center"),
	justify("center"),
	is("32px"),
	bs("32px"),
	p(0),
	rounded(),
	border("none"),
	bg("transparent"),
	fg("inherit"),
	cursor("pointer"),
	shrink(),
	hover(bg("neutral.bg-tint-hover")),
	media("(min-width: 768px)", hidden()),
]);

/**
 * The header cell: nav toggle + breadcrumb on the left, quick actions on the right.
 * `height` (with `boxSizing: border-box`, so padding/border count toward it) is fixed
 * at 64px so pages that pass no `actions` don't render a shorter header row.
 */
const header = combine([
	flex(),
	items("center"),
	justify("between"),
	gap(4),
	bs("64px"),
	boxSizing("border-box"),
	pi(5),
	borderEdge("bottom", { color: "neutral", width: 1 }),
	shrink(),
	media("(min-width: 768px)", gridArea("header")),
]);

/**
 * The breadcrumb trail above the heading, truncated to one line like the
 * heading below it. Without truncation, a wrapping trail grows taller
 * instead of narrower, pushing three lines into a header fixed at 64px.
 */
const breadcrumbTrail = combine([truncate(), minIs(0)]);

/** The current page/section name, replacing what used to be each page's own `<h1>`. */
const breadcrumbText = combine([
	truncate(),
	fontSize("0.9375rem"),
	weight(600),
	fg("neutral.emphasis"),
]);

/**
 * Wraps the small `Breadcrumbs` trail and the bold {@link breadcrumbText} heading in
 * a single column so both sit stacked, vertically centered within the fixed-height
 * {@link header} row.
 */
const headingColumn = combine([flex(), flexCol(), justify("center"), gap("2px"), minIs(0)]);

/**
 * The sidebar's popover drawer: a native, full-height overlay below 768px
 * that becomes `display: contents` at ≥768px (see the file docblock); the
 * `!important`s beat the UA stylesheet's default `display: none`.
 */
const sidebarNav = combine([
	fixed(),
	insTop(0),
	insLeft(0),
	insBottom(0),
	m(0),
	/**
	 * The UA popover stylesheet applies `height: fit-content` to every `[popover]`
	 * element regardless of open state — left unset, that beats this element's
	 * intended full-height drawer size below 768px.
	 */
	bs("full"),
	boxSizing("border-box"),
	hidden(),
	flexCol(),
	overflow(),
	is("min(80vw, 288px)"),
	maxBs("100vh"),
	p(0),
	border("none"),
	borderEdge("right", { color: "neutral", width: 1 }),
	bg("neutral.tint"),
	shadow("lg"),
	when("&::backdrop", bg("rgba(0, 0, 0, 0.4)")),
	when("&:popover-open", raw({ display: "flex !important" })),
	media("(min-width: 768px)", raw({ display: "contents !important" })),
]);

/**
 * Top sidebar cell: the team picker, sharing row 1 with `header` at ≥768px
 * so the grid's `align-items: stretch` gives both the same height, with a
 * right border continuing the divider below it.
 */
const teamPickerCell = combine([
	flex(),
	items("center"),
	p("10px", "12px"),
	shrink(),
	media("(min-width: 768px)", [
		gridArea("teampicker"),
		p(0, 4),
		borderEdge("bottom", { color: "neutral", width: 1 }),
		borderEdge("right", { color: "neutral", width: 1 }),
	]),
]);

/**
 * Middle sidebar cell: the primary + admin-only nav lists. Independently scrollable
 * (`overflow-y: auto`, `minHeight: 0`) so a long nav list never pushes the user menu
 * below the sidebar's own scroll instead of staying pinned to the bottom.
 */
const navCell = combine([
	flex(),
	flexCol(),
	gap(3),
	grow(),
	shrink(1),
	basis("0%"),
	minBs(0),
	overflowY("auto"),
	p(4, 3),
	media("(min-width: 768px)", [
		gridArea("nav"),
		borderEdge("right", { color: "neutral", width: 1 }),
	]),
]);

/** Bottom sidebar cell: the user menu. */
const userMenuCell = combine([
	p(4),
	borderEdge("top", { color: "neutral", width: 1 }),
	shrink(),
	media("(min-width: 768px)", [
		gridArea("usermenu"),
		p(4),
		borderEdge("top", { color: "neutral", width: 1 }),
		borderEdge("right", { color: "neutral", width: 1 }),
	]),
]);

/**
 * Plain (non-interactive) row for the team picker when the viewer has
 * one team. `minWidth: 0` lets {@link truncatedLabel}'s ellipsis kick in
 * instead of the row growing past its intended width.
 */
const teamPickerRow = combine([flex(), items("center"), gap(2), minIs(0), is("full")]);

/**
 * Interactive team/user-menu trigger, opened via the `commandfor`/
 * `command="toggle-popover"` relationship that also gives `Menu` its
 * implicit CSS anchor; `width: 100%` keeps it flush with the cell's padding.
 */
const menuTriggerButton = combine([
	flex(),
	items("center"),
	gap(2),
	is("full"),
	minIs(0),
	p("6px", "8px"),
	border("none"),
	rounded("lg"),
	bg("transparent"),
	raw({ font: "inherit" }),
	textAlign("left"),
	cursor("pointer"),
	fg("inherit"),
	hover(bg("neutral.bg-tint-hover")),
]);

/** Truncated name/label text next to a logo/avatar in the team picker and user menu. */
const truncatedLabel = combine([
	grow(),
	shrink(1),
	basis("0%"),
	minIs(0),
	truncate(),
	fontSize("0.875rem"),
	weight(500),
	fg("neutral.emphasis"),
]);

/**
 * The "switch" affordance icon at the end of the team-picker/user-menu
 * triggers, explicitly colored to match {@link truncatedLabel} since
 * `currentColor` won't inherit between sibling elements.
 */
const menuChevronIcon = combine([shrink(), fg("neutral.emphasis")]);

/** A nav-list `<ul>` (used for both the primary and admin-only groups). */
const navList = combine([listStyle(), m(0), p(0), flex(), flexCol(), gap(1)]);

/** The page's main content area (grid area "content", spanning both content-side rows at ≥768px). */
const main = combine([
	minIs(0),
	p(5),
	overflow("auto"),
	media("(min-width: 768px)", [gridArea("content"), p(12)]),
]);

namespace AppShell {
	export interface Props {
		team: { id: string; slug: string; name: string; logo: string | null };
		teams: Array<{ id: string; slug: string; name: string; logo: string | null }>;
		viewer: { name: string; email: string; avatar: string };
		isAdmin: boolean;
		/**
		 * The request's i18next instance, used to read every string the shell
		 * owns under `app.layout.*`. Required, so a missing instance is caught
		 * at compile time and every render uses the caller's real translations.
		 */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Bold page title, shown in the header in place of a per-page `<h1>`. */
		heading: string;
		/**
		 * Small trail of parent pages shown above {@link AppShell.Props.heading}.
		 * Omit it (or pass an empty array) to render no trail, e.g. on the
		 * dashboard. A segment with no `href` renders as plain text.
		 */
		breadcrumbs?: Array<{ label: string; href?: string }>;
		/**
		 * The current request's URL path (e.g. `ctx.url.pathname`), compared
		 * against each nav item's `href` to mark the active link. Optional: nav
		 * links render with no active state until a page's controller passes it.
		 */
		currentPath?: string;
		/** Page-specific quick actions (e.g. "Create monitor"), shown at the end of the header. */
		actions?: RemixNode;
		toast?: { intent: "success" | "error"; message: string };
		children: RemixNode;
	}
}

/**
 * Renders the sidebar (team picker, primary nav, admin-only nav, user
 * menu) plus header and main content area around `children`, and mounts
 * `AppToaster` so any island can call `showToast()` without its own region.
 */
export default function AppShell(handle: Handle<AppShell.Props>) {
	return () => {
		let {
			team,
			teams,
			viewer,
			isAdmin,
			i18next,
			heading,
			breadcrumbs,
			currentPath,
			actions,
			toast,
			children,
		} = handle.props;

		let t = i18next.getFixedT(null, "translation", "app.layout");
		let dashboardHref = routes.app.team.dashboard.index.href({ team: team.slug });

		/**
		 * A nav item is active on an exact match, or (except the dashboard) when
		 * `currentPath` is nested under it, so "HTTP Monitors" stays highlighted
		 * on a monitor's own detail page; the dashboard link is never a parent.
		 */
		function isNavItemActive(href: string): boolean {
			if (currentPath === undefined) return false;
			if (currentPath === href) return true;
			return href !== dashboardHref && currentPath.startsWith(`${href}/`);
		}

		let primaryNavItems: Array<{ href: string; label: string; icon: RemixNode }> = [
			{
				href: dashboardHref,
				label: t("sidebar.navigation.items.dashboard"),
				icon: <ActivityIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.monitors.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.httpMonitors"),
				icon: <MonitorCogIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.dnsMonitors.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.dnsMonitors"),
				icon: <GlobeIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.tcpMonitors.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.tcpMonitors"),
				icon: <NetworkIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.flowMonitors.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.flowMonitors"),
				icon: <WorkflowIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.cronJobs.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.cronJobs"),
				icon: <ClockIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.alerts.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.alerts"),
				icon: <BellIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.maintenanceWindows.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.maintenance"),
				icon: <WrenchIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.statusPages.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.statusPages"),
				icon: <FileTextIcon size={16} strokeWidth={1.5} />,
			},
		];

		let adminNavItems: Array<{
			href: string;
			label: string;
			icon: RemixNode;
			target?: "_blank";
		}> = [
			{
				href: routes.docs.index.href(),
				label: t("sidebar.navigation.items.docs"),
				target: "_blank",
				icon: <BookOpenIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.apiKeys.index.href({ team: team.slug }),
				label: t("sidebar.navigation.items.apiKeys"),
				icon: <KeyIcon size={16} strokeWidth={1.5} />,
			},
			{
				href: routes.app.team.settings.href({ team: team.slug }),
				label: t("sidebar.navigation.items.settings"),
				icon: <SettingsIcon size={16} strokeWidth={1.5} />,
			},
		];

		return (
			<div mix={[page]}>
				<nav id="app-sidebar" popover="auto" mix={[sidebarNav]}>
					<div mix={[teamPickerCell]}>
						{teams.length <= 1 ? (
							<div mix={[teamPickerRow]}>
								<Logo src={team.logo} name={team.name} />
								<span mix={[truncatedLabel]}>{team.name}</span>
							</div>
						) : (
							<>
								<button
									type="button"
									commandfor="team-picker-menu"
									command="toggle-popover"
									aria-label={t("sidebar.teamPicker.label")}
									mix={[menuTriggerButton]}
								>
									<Logo src={team.logo} name={team.name} />
									<span mix={[truncatedLabel]}>{team.name}</span>
									<ChevronsUpDownIcon size={14} strokeWidth={1.5} mix={[menuChevronIcon]} />
								</button>
								<Menu
									id="team-picker-menu"
									aria-label={t("sidebar.teamPicker.label")}
									mix={[menuKeys()]}
								>
									{teams.map((t) => (
										<Menu.Item
											key={t.id}
											href={routes.app.team.dashboard.index.href({ team: t.slug })}
										>
											<Logo src={t.logo} name={t.name} />
											<span mix={[truncatedLabel]}>{t.name}</span>
											{t.slug === team.slug && <CheckIcon size={14} strokeWidth={1.5} />}
										</Menu.Item>
									))}
								</Menu>
							</>
						)}
					</div>

					<div mix={[navCell]}>
						<ul mix={[navList]}>
							{primaryNavItems.map((item) => (
								<li key={item.href}>
									<Sidebar.Item href={item.href} current={isNavItemActive(item.href)}>
										{item.icon}
										<span>{item.label}</span>
									</Sidebar.Item>
								</li>
							))}
						</ul>

						{isAdmin && (
							<ul mix={[navList, mbs("auto")]}>
								{adminNavItems.map((item) => (
									<li key={item.href}>
										<Sidebar.Item
											href={item.href}
											target={item.target}
											rel={item.target ? "noreferrer" : undefined}
											current={isNavItemActive(item.href)}
										>
											{item.icon}
											<span>{item.label}</span>
										</Sidebar.Item>
									</li>
								))}
							</ul>
						)}
					</div>

					<div mix={[userMenuCell]}>
						<button
							type="button"
							commandfor="user-menu"
							command="toggle-popover"
							aria-label={t("sidebar.userMenu.label")}
							mix={[menuTriggerButton]}
						>
							<Avatar src={viewer.avatar || null} name={viewer.name} />
							<span mix={[truncatedLabel]}>{viewer.name}</span>
							<ChevronsUpDownIcon size={14} strokeWidth={1.5} mix={[menuChevronIcon]} />
						</button>
						<Menu
							id="user-menu"
							placement="top-start"
							aria-label={t("sidebar.userMenu.label")}
							mix={[menuKeys()]}
						>
							<Menu.Item href={routes.app.team.account.href({ team: team.slug })}>
								{t("sidebar.account.title")}
							</Menu.Item>
							<Menu.Item href={routes.logout.index.href()}>
								{t("sidebar.account.signOut")}
							</Menu.Item>
						</Menu>
					</div>
				</nav>

				<div mix={[header]}>
					<div mix={[row]}>
						<button
							type="button"
							commandfor="app-sidebar"
							command="toggle-popover"
							aria-label={t("sidebar.toggle")}
							mix={[sidebarToggle]}
						>
							<PanelLeftIcon size={18} strokeWidth={1.5} />
						</button>
						<div mix={[headingColumn]}>
							{breadcrumbs && breadcrumbs.length > 0 && (
								<Breadcrumbs aria-label={t("breadcrumbs.label")} mix={[breadcrumbTrail]}>
									<Breadcrumbs.List>
										{breadcrumbs.map((crumb, index) => (
											<Breadcrumbs.Item key={`${crumb.label}-${index}`}>
												{crumb.href ? (
													<Breadcrumbs.Link href={crumb.href}>{crumb.label}</Breadcrumbs.Link>
												) : (
													<span>{crumb.label}</span>
												)}
											</Breadcrumbs.Item>
										))}
									</Breadcrumbs.List>
								</Breadcrumbs>
							)}
							<span mix={[breadcrumbText]}>{heading}</span>
						</div>
					</div>
					{actions && <div mix={[row]}>{actions}</div>}
				</div>

				<main mix={[main]}>{children}</main>

				{toast && (
					<FlashToast
						color={toast.intent === "success" ? "success" : "danger"}
						label={t("toasts.region")}
						description={toast.message}
					/>
				)}

				<AppToaster />
			</div>
		);
	};
}
