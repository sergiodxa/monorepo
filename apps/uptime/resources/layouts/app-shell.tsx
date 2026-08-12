/**
 * Signed-in app shell layout: a full-height sidebar (team switcher, icon nav links,
 * admin-only group, user menu) on the left, and a header (breadcrumb + page-specific
 * quick actions) above the page's main content on the right. Every `/app/:team/*`
 * page composes its content into this shell. It exists as the shared frame every
 * team-area page renders inside.
 *
 * At ≥768px this is a CSS grid with a named-area layout:
 *
 * ```
 * | team picker | header  |
 * | nav list    | content |
 * | user menu   | content |
 * ```
 *
 * — a grid rather than nested flex rows/columns because the team-picker cell and the
 * header cell need to share exactly one row's height (so the divider below the team
 * picker lines up with the divider below the header): the grid's default
 * `align-items: stretch` gives every cell in a row the row's full height for free,
 * with no hardcoded pixel height to keep in sync between two unrelated elements.
 * This exact three-row/two-column grid-area layout, and the single-DOM-tree
 * `display: contents` off-canvas trick below, has no equivalent in `@pkg/ui`'s own
 * `Sidebar` (which assumes a persistent `<aside>` beside an `Inset`, plus a *separate*
 * `Dialog`-based `MobileNav` tree for narrow viewports) — so this file keeps that
 * outer composition as its own layout and only swaps in the pieces `@pkg/ui` does
 * have a real component for: `Menu` (the team/user dropdowns), `Breadcrumbs` (the
 * trail), and `Sidebar.Item` (the nav rows themselves). The bottom notification is
 * `FlashToast`, which is `@pkg/ui`'s `Toast` in the region and the self-fading treatment
 * this app renders one in.
 *
 * The sidebar's three sections (team picker / nav list / user menu) are DOM children
 * of one `<nav popover>` element (so the mobile off-canvas drawer can show/hide them
 * as a single unit), but at ≥768px that `<nav>` switches to `display: contents` —
 * generating no box of its own — so its three children become direct items of the
 * outer grid instead of one flex column inside a "sidebar" grid cell. Below 768px,
 * `grid-area` on those children is simply inert (their containing block isn't a grid
 * there), and the `<nav>` lays them out as an ordinary flex column, exactly like the
 * mobile drawer always has.
 *
 * Page-specific copy (`heading`, `breadcrumbs`) arrives already translated from the
 * controller, but the chrome's own copy — nav labels, the user menu, and the landmark
 * names a screen reader announces — belongs to this file, so it takes the request's
 * `i18next` and resolves those from `app.layout.*` itself. The prop is required: a shell
 * that quietly falls back to English when a page forgets to pass it is a bug that
 * renders perfectly and is only ever noticed by the readers it fails.
 *
 * There is no separate top-level header spanning the sidebar's width — the team
 * switcher already names the team once, in the sidebar, so a page never repeats it a
 * second time as a header title or a third time as its own `<h1>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
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
 * The page shell. Below 768px, a plain flex column — the sidebar `<nav>` is either
 * closed (`display: none`, no box) or an off-canvas overlay (top-layer, outside
 * normal flow either way), so header+main are simply the only flex children that
 * matter. At ≥768px it becomes the two-column, three-row grid described above.
 * `height`/`width` stay physical (not `bs()`/`is()`) here since this IS the
 * viewport-sized outer frame — `grid-template-*` has no `@pkg/u` equivalent and
 * stays a bespoke `raw()` declaration.
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
 * The sidebar's popover drawer. Below 768px this is a native popover — hidden until
 * opened by the header's hamburger button — rendered as a fixed, full-height overlay
 * sheet with its own backdrop: a flex column of its three sections, with the middle
 * one (`navCell`, below) independently scrollable so the team picker and user menu
 * stay pinned. At ≥768px it becomes `display: contents` (see the file docblock) —
 * the `!important`s throughout are required to beat the UA stylesheet's
 * `[popover]:not(:popover-open) { display: none }`, which otherwise wins on
 * specificity. `top`/`left`/`bottom` stay the physical `insTop()`/`insLeft()`/
 * `insBottom()` exceptions since this drawer is pinned to the physical viewport
 * edge it slides in from, not a logical writing-direction edge.
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
 * Top sidebar cell: the team picker. Shares row 1 with `header` at ≥768px — the
 * grid's default `align-items: stretch` gives both the same height, so their
 * `borderBottom`s land at the same y — with a matching `borderRight` to continue the
 * vertical divider between the sidebar and the content column.
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
 * Plain (non-interactive) row used for the team picker when the viewer has one team.
 * `minWidth: 0` is required for `truncatedLabel`'s ellipsis to actually kick in —
 * without it, this row (and the sidebar itself) would rather grow past its intended
 * width than truncate the team name.
 */
const teamPickerRow = combine([flex(), items("center"), gap(2), minIs(0), is("full")]);

/**
 * Interactive team/user-menu trigger button, styled to look like the plain row
 * above and opened via the same `commandfor`/`command="toggle-popover"` Invoker
 * Commands relationship a `Menu` documents — that same invoker relationship is also
 * what gives the `Menu` its implicit CSS anchor, with no extra wiring on this button.
 * `width: 100%` alone (no negative-margin "bleed" trick) keeps its left/right edges
 * flush with its parent cell's own padding on both sides equally — the cell's
 * padding IS the button's margin from the sidebar's edge. `font` stays
 * `raw()` — the CSS `font` shorthand has no `@pkg/u` equivalent — while the
 * physical (non-logical) text alignment uses `textAlign()`'s raw-string
 * escape.
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
 * The "switch" affordance icon at the end of the team-picker/user-menu triggers.
 * Explicitly colored to match `truncatedLabel` — `currentColor` alone isn't reliable
 * here, since the icon and the label are siblings rather than parent/child, so they
 * don't necessarily inherit the same computed color.
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
		 * The request's i18next instance, used to read every string the shell owns
		 * (nav labels, menu items, and the landmark labels under `app.layout.*`).
		 * Required rather than optional: a layout that falls back to English when a
		 * caller forgets is a bug that renders fine and so never gets reported, while
		 * a missing required prop is a type error the compiler reports at once.
		 */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Bold page title, shown in the header in place of a per-page `<h1>`. */
		heading: string;
		/**
		 * Small trail of parent pages shown above {@link AppShell.Props.heading}. Omit
		 * (or pass an empty array) to render no trail at all, e.g. on the dashboard.
		 * Segments with no `href` (typically only the last, current-page segment)
		 * render as plain text instead of a link.
		 */
		breadcrumbs?: Array<{ label: string; href?: string }>;
		/**
		 * The current request's URL path (e.g. `ctx.url.pathname`), compared against
		 * each nav item's `href` to mark the matching link as the active one. Optional
		 * since not every caller passes it yet; nav links simply render with no active
		 * state until a given page's controller starts passing it.
		 */
		currentPath?: string;
		/** Page-specific quick actions (e.g. "Create monitor"), shown at the end of the header. */
		actions?: RemixNode;
		toast?: { intent: "success" | "error"; message: string };
		children: RemixNode;
	}
}

/** Renders the sidebar (team picker, primary nav, admin-only nav, user menu) plus header and main content area around `children`. */
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
		 * A nav item is active on an exact match, or (for every item except the
		 * dashboard) when `currentPath` is nested under it, e.g. so "HTTP Monitors"
		 * stays highlighted on a specific monitor's own detail/edit page. The
		 * dashboard link is excluded from the prefix check since it's never a parent
		 * of another route the way the other nav items are.
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
								<Breadcrumbs aria-label={t("breadcrumbs.label")}>
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

				{/*
				 * Mounted on every signed-in page, not just the ones that toast today, so any
				 * island can call `showToast()` without first arranging for a region of its
				 * own. It renders no markup until something is queued, so the cost of having
				 * it here is one hydration marker.
				 */}
				<AppToaster />
			</div>
		);
	};
}
