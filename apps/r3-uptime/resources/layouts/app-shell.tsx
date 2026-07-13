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
 * There is no separate top-level header spanning the sidebar's width — the team
 * switcher already names the team once, in the sidebar, so a page never repeats it a
 * second time as a header title or a third time as its own `<h1>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import Avatar from "~/resources/components/avatar";
import Logo from "~/resources/components/logo";
import routes from "~/routes/web";

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	100: "oklch(0.96 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
};

/**
 * The page shell. Below 768px, a plain flex column — the sidebar `<nav>` is either
 * closed (`display: none`, no box) or an off-canvas overlay (top-layer, outside
 * normal flow either way), so header+main are simply the only flex children that
 * matter. At ≥768px it becomes the two-column, three-row grid described above.
 */
const page = css({
	display: "flex",
	flexDirection: "column",
	height: "100vh",
	overflow: "hidden",
	"@media (min-width: 768px)": {
		display: "grid",
		gridTemplateColumns: "256px 1fr",
		gridTemplateRows: "auto 1fr auto",
		gridTemplateAreas: `"teampicker header" "nav content" "usermenu content"`,
	},
});

/** Horizontal group of inline items (nav toggle + breadcrumb, action buttons). */
const row = css({ display: "flex", alignItems: "center", gap: 12, minWidth: 0 });

/**
 * The hamburger button that opens the sidebar on mobile via the native Command
 * Invoker API (`commandfor`/`command="toggle-popover"`). Hidden at ≥768px, where the
 * sidebar is always visible and a toggle would be redundant.
 */
const sidebarToggle = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: 32,
	height: 32,
	padding: 0,
	borderRadius: 6,
	border: "none",
	background: "transparent",
	color: "inherit",
	cursor: "pointer",
	flexShrink: 0,
	"&:hover": { background: neutral[100] },
	"@media (min-width: 768px)": { display: "none" },
	"@media (prefers-color-scheme: dark)": { "&:hover": { background: neutral[800] } },
});

/**
 * The header cell: nav toggle + breadcrumb on the left, quick actions on the right.
 * `height` (with `boxSizing: border-box`, so padding/border count toward it) is fixed
 * at 64px so pages that pass no `actions` don't render a shorter header row.
 */
const header = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 16,
	height: 64,
	boxSizing: "border-box",
	padding: "0 20px",
	borderBottom: `1px solid ${neutral[200]}`,
	flexShrink: 0,
	"@media (min-width: 768px)": { gridArea: "header" },
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

/** The current page/section name, replacing what used to be each page's own `<h1>`. */
const breadcrumbText = css({
	fontSize: "0.9375rem",
	fontWeight: 600,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/**
 * The sidebar's popover drawer. Below 768px this is a native popover — hidden until
 * opened by the header's hamburger button — rendered as a fixed, full-height overlay
 * sheet with its own backdrop: a flex column of its three sections, with the middle
 * one (`navCell`, below) independently scrollable so the team picker and user menu
 * stay pinned. At ≥768px it becomes `display: contents` (see the file docblock) —
 * the `!important`s throughout are required to beat the UA stylesheet's
 * `[popover]:not(:popover-open) { display: none }`, which otherwise wins on
 * specificity.
 */
const sidebarNav = css({
	position: "fixed",
	top: 0,
	left: 0,
	bottom: 0,
	margin: 0,
	/**
	 * The UA popover stylesheet applies `height: fit-content` to every `[popover]`
	 * element regardless of open state — left unset, that beats this element's
	 * intended full-height drawer size below 768px.
	 */
	height: "100%",
	boxSizing: "border-box",
	display: "none",
	flexDirection: "column",
	overflow: "hidden",
	width: "min(80vw, 288px)",
	maxHeight: "100vh",
	padding: 0,
	border: "none",
	borderRight: `1px solid ${neutral[200]}`,
	background: "#ffffff",
	boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
	"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
	"&:popover-open": { display: "flex !important" },
	"@media (min-width: 768px)": {
		display: "contents !important",
	},
	"@media (prefers-color-scheme: dark)": {
		background: neutral[950],
		borderColor: neutral[800],
	},
});

/**
 * Top sidebar cell: the team picker. Shares row 1 with `header` at ≥768px — the
 * grid's default `align-items: stretch` gives both the same height, so their
 * `borderBottom`s land at the same y — with a matching `borderRight` to continue the
 * vertical divider between the sidebar and the content column.
 */
const teamPickerCell = css({
	display: "flex",
	alignItems: "center",
	padding: "10px 12px",
	flexShrink: 0,
	"@media (min-width: 768px)": {
		gridArea: "teampicker",
		padding: "0 16px",
		borderBottom: `1px solid ${neutral[200]}`,
		borderRight: `1px solid ${neutral[200]}`,
	},
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

/**
 * Middle sidebar cell: the primary + admin-only nav lists. Independently scrollable
 * (`overflow-y: auto`, `minHeight: 0`) so a long nav list never pushes the user menu
 * below the sidebar's own scroll instead of staying pinned to the bottom.
 */
const navCell = css({
	display: "flex",
	flexDirection: "column",
	gap: 12,
	flex: 1,
	minHeight: 0,
	overflowY: "auto",
	padding: "8px 12px",
	"@media (min-width: 768px)": {
		gridArea: "nav",
		borderRight: `1px solid ${neutral[200]}`,
	},
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

/** Bottom sidebar cell: the user menu. */
const userMenuCell = css({
	padding: "8px 12px",
	flexShrink: 0,
	"@media (min-width: 768px)": {
		gridArea: "usermenu",
		padding: "8px 16px 16px",
		borderRight: `1px solid ${neutral[200]}`,
	},
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

/**
 * Plain (non-interactive) row used for the team picker when the viewer has one team.
 * `minWidth: 0` is required for `truncatedLabel`'s ellipsis to actually kick in —
 * without it, this row (and the sidebar itself) would rather grow past its intended
 * width than truncate the team name.
 */
const teamPickerRow = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	minWidth: 0,
	width: "100%",
});

/**
 * Interactive team/user-menu trigger button, styled to look like the plain row
 * above. `width: 100%` alone (no negative-margin "bleed" trick) keeps its left/right
 * edges flush with its parent cell's own padding on both sides equally — the cell's
 * padding IS the button's margin from the sidebar's edge.
 */
const menuTriggerButton = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	width: "100%",
	minWidth: 0,
	padding: "6px 8px",
	border: "none",
	borderRadius: 8,
	background: "transparent",
	font: "inherit",
	textAlign: "left",
	cursor: "pointer",
	color: "inherit",
	"&:hover": { background: neutral[100] },
	"@media (prefers-color-scheme: dark)": { "&:hover": { background: neutral[800] } },
});

/** Truncated name/label text next to a logo/avatar in the team picker and user menu. */
const truncatedLabel = css({
	flex: 1,
	minWidth: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	fontSize: "0.875rem",
	fontWeight: 500,
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/**
 * The "switch" affordance icon at the end of the team-picker/user-menu triggers.
 * Explicitly colored to match `truncatedLabel` — `currentColor` alone isn't reliable
 * here, since the icon and the label are siblings rather than parent/child, so they
 * don't necessarily inherit the same computed color.
 */
const menuChevronIcon = css({
	flexShrink: 0,
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** A compact up/down chevron pair, the "expand/switch" indicator for the team-picker and user-menu trigger buttons. */
function ChevronsUpDownIcon(_handle: Handle<Record<string, never>>) {
	return () => (
		<svg
			viewBox="0 0 20 20"
			width={14}
			height={14}
			fill="none"
			aria-hidden="true"
			mix={[menuChevronIcon]}
		>
			<path
				d="M6 8l4-4 4 4M6 12l4 4 4-4"
				stroke="currentColor"
				strokeWidth={1.5}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/**
 * Fixed, viewport-relative dropdown panel for the team-picker/user-menu popovers.
 * Native `popover` elements are promoted to the top layer and, unless positioned
 * ourselves, default to `position: fixed` centered in the viewport — they aren't
 * anchored to their trigger (no nearest-positioned-ancestor relationship, since
 * top-layer rendering escapes normal containing-block rules). Since this app is
 * platform-only (no floating-ui/JS positioning), we place the panel near the
 * sidebar's left edge (always at viewport x=0, in both mobile-drawer and
 * desktop-grid modes) with a fixed `top`/`bottom` offset instead.
 */
function dropdownPanel(edge: { top: number } | { bottom: number }) {
	return css({
		position: "fixed",
		/**
		 * The UA popover stylesheet defaults [popover] elements to `inset: 0` (plus
		 * `margin: auto` for auto-centering). Both `top` and `bottom` must be given
		 * explicit values here (one of them "auto") — otherwise the UA's own `top: 0`/
		 * `bottom: 0` wins the over-constrained vertical box model against whichever
		 * side we didn't set, and our offset is silently ignored.
		 */
		top: "top" in edge ? edge.top : "auto",
		bottom: "bottom" in edge ? edge.bottom : "auto",
		left: 12,
		width: 200,
		margin: 0,
		padding: 6,
		borderRadius: 8,
		border: `1px solid ${neutral[200]}`,
		background: "#ffffff",
		boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
		"&::backdrop": { background: "rgba(0, 0, 0, 0.2)" },
		"@media (prefers-color-scheme: dark)": {
			background: neutral[950],
			borderColor: neutral[800],
		},
	});
}

/** Single link/row inside a dropdown panel (team-picker or user-menu). */
const dropdownItem = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "6px 8px",
	borderRadius: 6,
	fontSize: "0.875rem",
	color: neutral[900],
	textDecoration: "none",
	"&:hover": { background: neutral[100] },
	"@media (prefers-color-scheme: dark)": {
		color: neutral[50],
		"&:hover": { background: neutral[800] },
	},
});

/** A nav-list `<ul>` (used for both the primary and admin-only groups). */
const navList = css({
	listStyle: "none",
	margin: 0,
	padding: 0,
	display: "flex",
	flexDirection: "column",
	gap: 4,
});

/** A single nav link, icon + label laid out in a row. */
const navLink = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "8px 12px",
	borderRadius: 8,
	fontSize: "0.875rem",
	fontWeight: 500,
	color: neutral[500],
	textDecoration: "none",
	"&:hover": { background: neutral[100], color: neutral[900] },
	"@media (prefers-color-scheme: dark)": {
		color: neutral[400],
		"&:hover": { background: neutral[800], color: neutral[50] },
	},
});

/**
 * Applied on top of {@link navLink} for whichever item's `href` matches the current
 * page, so the "you are here" state reads as a persistent selection rather than the
 * same transient background {@link navLink}'s `&:hover` uses.
 */
const navLinkActive = css({
	background: neutral[200],
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { background: neutral[800], color: neutral[50] },
});

/** The page's main content area (grid area "content", spanning both content-side rows at ≥768px). */
const main = css({
	minWidth: 0,
	padding: 20,
	overflow: "auto",
	"@media (min-width: 768px)": { gridArea: "content", padding: 48 },
});

namespace AppShell {
	export interface Props {
		team: { id: string; slug: string; name: string; logo: string | null };
		teams: Array<{ id: string; slug: string; name: string; logo: string | null }>;
		viewer: { name: string; email: string; avatar: string };
		isAdmin: boolean;
		/** Current page/section name, shown in the header in place of a per-page `<h1>`. */
		breadcrumb: string;
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

export default function AppShell(handle: Handle<AppShell.Props>) {
	return () => {
		let { team, teams, viewer, isAdmin, breadcrumb, currentPath, actions, toast, children } =
			handle.props;

		let primaryNavItems: Array<{ href: string; label: string; icon: RemixNode }> = [
			{
				href: routes.app.team.dashboard.index.href({ team: team.slug }),
				label: "Dashboard",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<path
							d="M2 10h3l2-6 4 12 2-6h5"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.httpMonitors.href({ team: team.slug }),
				label: "HTTP Monitors",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<rect
							x="2"
							y="3"
							width="16"
							height="11"
							rx="1.5"
							stroke="currentColor"
							strokeWidth={1.5}
						/>
						<path
							d="M6 17h8M10 14v3"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.dnsMonitors.href({ team: team.slug }),
				label: "DNS Monitors",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth={1.5} />
						<path
							d="M3 10h14M10 3c2.2 2 2.2 12 0 14M10 3c-2.2 2-2.2 12 0 14"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.tcpMonitors.href({ team: team.slug }),
				label: "TCP Monitors",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth={1.5} />
						<circle cx="16" cy="4" r="2" stroke="currentColor" strokeWidth={1.5} />
						<circle cx="10" cy="16" r="2" stroke="currentColor" strokeWidth={1.5} />
						<path
							d="M4 6v2a3 3 0 003 3h1M16 6v2a3 3 0 01-3 3h-1"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.cronJobs.href({ team: team.slug }),
				label: "Cron Jobs",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth={1.5} />
						<path
							d="M10 6v4l3 2"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.alerts.href({ team: team.slug }),
				label: "Alerts",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<path
							d="M5.5 8a4.5 4.5 0 019 0c0 3.5 1.3 4.5 1.3 4.5h-11.6S5.5 11.5 5.5 8z"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M8.3 15.5a1.7 1.7 0 003.4 0"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.maintenanceWindows.href({ team: team.slug }),
				label: "Maintenance",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<path
							d="M13.3 4.7a3.3 3.3 0 00-4.5 4l-5.3 5.3 2 2 5.3-5.3a3.3 3.3 0 004-4.5l-2.1 2.1-2-2z"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.statusPages.href({ team: team.slug }),
				label: "Status pages",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<path
							d="M6 2.5h5.5L15 6v11.5H6z"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M8 9.5h6M8 12.5h6M8 15.5h3.5"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
					</svg>
				),
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
				label: "Docs",
				target: "_blank",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<path
							d="M2.5 5c1.8-1 4.5-1 6.5 0v10.5c-2-1-4.7-1-6.5 0V5zM17.5 5c-1.8-1-4.5-1-6.5 0v10.5c2-1 4.7-1 6.5 0V5z"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.apiKeys.href({ team: team.slug }),
				label: "API keys",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<circle cx="6" cy="14" r="2.8" stroke="currentColor" strokeWidth={1.5} />
						<path
							d="M8.2 11.8L16 4M12.5 7.5l1.7 1.7M14.7 5.3l1.7 1.7"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
			{
				href: routes.app.team.settings.href({ team: team.slug }),
				label: "Settings",
				icon: (
					<svg viewBox="0 0 20 20" width={16} height={16} fill="none" aria-hidden="true">
						<circle cx="10" cy="10" r="2.8" stroke="currentColor" strokeWidth={1.5} />
						<path
							d="M10 3v2M10 15v2M4 4.2l1.4 1.4M14.6 14.4l1.4 1.4M3 10h2M15 10h2M4 15.8l1.4-1.4M14.6 5.6l1.4-1.4"
							stroke="currentColor"
							strokeWidth={1.5}
							strokeLinecap="round"
						/>
					</svg>
				),
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
									aria-label="Switch team"
									mix={[menuTriggerButton]}
								>
									<Logo src={team.logo} name={team.name} />
									<span mix={[truncatedLabel]}>{team.name}</span>
									<ChevronsUpDownIcon />
								</button>
								<div id="team-picker-menu" popover="auto" mix={[dropdownPanel({ top: 47 })]}>
									<ul mix={[navList]}>
										{teams.map((t) => (
											<li key={t.id}>
												<a
													href={routes.app.team.dashboard.index.href({ team: t.slug })}
													mix={[dropdownItem]}
												>
													<Logo src={t.logo} name={t.name} />
													<span mix={[truncatedLabel]}>{t.name}</span>
													{t.slug === team.slug && (
														<svg
															viewBox="0 0 20 20"
															width={14}
															height={14}
															fill="none"
															aria-hidden="true"
														>
															<path
																d="M4 10l4 4 8-9"
																stroke="currentColor"
																strokeWidth={1.5}
																strokeLinecap="round"
																strokeLinejoin="round"
															/>
														</svg>
													)}
												</a>
											</li>
										))}
									</ul>
								</div>
							</>
						)}
					</div>

					<div mix={[navCell]}>
						<ul mix={[navList]}>
							{primaryNavItems.map((item) => (
								<li key={item.href}>
									<a
										href={item.href}
										aria-current={item.href === currentPath ? "page" : undefined}
										mix={item.href === currentPath ? [navLink, navLinkActive] : [navLink]}
									>
										{item.icon}
										<span>{item.label}</span>
									</a>
								</li>
							))}
						</ul>

						{isAdmin && (
							<ul mix={[navList, css({ marginTop: "auto" })]}>
								{adminNavItems.map((item) => (
									<li key={item.href}>
										<a
											href={item.href}
											target={item.target}
											rel={item.target ? "noreferrer" : undefined}
											aria-current={item.href === currentPath ? "page" : undefined}
											mix={item.href === currentPath ? [navLink, navLinkActive] : [navLink]}
										>
											{item.icon}
											<span>{item.label}</span>
										</a>
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
							aria-label="Account menu"
							mix={[menuTriggerButton]}
						>
							<Avatar src={viewer.avatar || null} name={viewer.name} />
							<span mix={[truncatedLabel]}>{viewer.name}</span>
							<ChevronsUpDownIcon />
						</button>
						<div id="user-menu" popover="auto" mix={[dropdownPanel({ bottom: 58 })]}>
							<a href={routes.app.team.account.href({ team: team.slug })} mix={[dropdownItem]}>
								Account
							</a>
							<a href={routes.logout.index.href()} mix={[dropdownItem]}>
								Sign out
							</a>
						</div>
					</div>
				</nav>

				<div mix={[header]}>
					<div mix={[row]}>
						<button
							type="button"
							commandfor="app-sidebar"
							command="toggle-popover"
							aria-label="Toggle navigation"
							mix={[sidebarToggle]}
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
						<span mix={[breadcrumbText]}>{breadcrumb}</span>
					</div>
					{actions && <div mix={[row]}>{actions}</div>}
				</div>

				<main mix={[main]}>{children}</main>

				{toast && (
					<p
						mix={[
							css({
								position: "fixed",
								bottom: 16,
								right: 16,
								padding: "10px 16px",
								borderRadius: 6,
								background: neutral[800],
								color: "#ffffff",
								fontSize: "0.875rem",
								animation: "uptime-toast-fade 5s ease forwards",
								"@keyframes uptime-toast-fade": {
									"0%": { opacity: 1 },
									"85%": { opacity: 1 },
									"100%": { opacity: 0, visibility: "hidden" },
								},
							}),
						]}
					>
						{toast.message}
					</p>
				)}
			</div>
		);
	};
}
