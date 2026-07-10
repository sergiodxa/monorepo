/**
 * Signed-in app shell layout: header (logo, team name), a sidebar navigation column
 * (team switcher, icon nav links, admin-only group, user menu), the page's main
 * content, and an optional flash toast. Every `/app/:team/*` page composes its
 * content into this shell. It exists as the shared frame every team-area page
 * renders inside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import routes from "~/routes/web";

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	100: "oklch(0.96 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
};

/** Primary (brand) scale shades used on this page, hue 142. */
const primary100 = "oklch(0.92 0.08 142)";
const primary600 = "oklch(0.6 0.16 142)";

/**
 * Page-level flex column hard-capped to exactly one viewport height. This must be
 * `height` (not `minHeight`), and paired with `overflow: hidden`: `minHeight` is only
 * a floor, so if the sidebar's own nav-item list is taller than the viewport, the
 * whole page would grow to match it instead of the sidebar scrolling internally —
 * that's also what makes the header+content row below a well-defined (not
 * content-driven/circular) height for `flex: 1` to divide up.
 */
const page = css({
	display: "flex",
	flexDirection: "column",
	height: "100vh",
	overflow: "hidden",
});

/** Horizontal group of inline items (nav links, user info). */
const row = css({ display: "flex", alignItems: "center", gap: 12 });

/**
 * The hamburger button that opens the sidebar on mobile via the native Command
 * Invoker API (`commandfor`/`command="toggle-popover"`). Hidden at ≥768px,
 * matching the OLD APP's `Sidebar.Trigger` (`md:hidden`).
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
	"&:hover": { background: neutral[100] },
	"@media (min-width: 768px)": { display: "none" },
	"@media (prefers-color-scheme: dark)": { "&:hover": { background: neutral[800] } },
});

/** Muted small text (meta info). */
const mutedSmall = css({
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/**
 * The sidebar's popover drawer/column. Below the OLD APP's sidebar mobile breakpoint
 * (768px), this is a native popover — hidden until opened by the header's hamburger
 * button — rendered as a fixed, full-height overlay drawer with its own backdrop,
 * matching the OLD APP's `Sidebar` primitive switching to an `AriaModalOverlay` sheet
 * on mobile. At ≥768px it resets to a normal static column, always visible regardless
 * of open/closed state (the `!important`s are required to beat the UA stylesheet's
 * `[popover]:not(:popover-open) { display: none }`, which otherwise wins on
 * specificity). It's a flex column — team picker on top, nav lists in the middle, user
 * menu pushed to the bottom via `marginTop: auto` — but that `display: flex` can only
 * be set for the desktop case and for the mobile `:popover-open` state: setting it
 * unconditionally would itself beat the UA's closed-state `display: none` and leave the
 * drawer stuck open below 768px.
 */
const sidebarNav = css({
	position: "fixed",
	top: 0,
	left: 0,
	bottom: 0,
	margin: 0,
	// The UA popover stylesheet applies `height: fit-content` to every `[popover]`
	// element regardless of open state — left unset, that beats the parent flex
	// row's default `align-items: stretch`, so the nav never actually reaches the
	// row's full height and `marginTop: "auto"` on the user-menu block below has no
	// extra space to push into. Force it to fill instead.
	height: "100%",
	// Without this, `height: 100%` sizes only the content box, and this element's own
	// `padding` below is added on top — the rendered box ends up taller than its
	// flex container by exactly the vertical padding, overflowing past the viewport.
	boxSizing: "border-box",
	// Belt-and-suspenders: now that the page shell hard-caps to one viewport height,
	// this should rarely trigger, but if the nav-item list is ever taller than the
	// available height (a very short window, or a team with many nav items), it
	// scrolls internally instead of silently clipping the user menu at the bottom.
	overflowY: "auto",
	gap: 12,
	width: "min(80vw, 288px)",
	maxHeight: "100vh",
	padding: "16px 12px",
	border: "none",
	borderRight: `1px solid ${neutral[200]}`,
	background: "#ffffff",
	boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
	"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
	"&:popover-open": { display: "flex", flexDirection: "column" },
	"@media (min-width: 768px)": {
		display: "flex !important",
		flexDirection: "column",
		position: "static",
		top: "auto",
		left: "auto",
		bottom: "auto",
		width: 220,
		maxHeight: "none",
		flexShrink: 0,
		boxShadow: "none",
	},
	"@media (prefers-color-scheme: dark)": {
		background: neutral[950],
		borderColor: neutral[800],
	},
});

/** Plain (non-interactive) row used for the team picker when the viewer has one team. */
const teamPickerRow = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "6px 8px",
});

/** Interactive team/user-menu trigger button, styled to look like the plain row above. */
const menuTriggerButton = css({
	display: "flex",
	alignItems: "center",
	gap: 8,
	width: "100%",
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

/** 24x24 rounded-square image, used for a team's logo. */
const teamLogoImage = css({ width: 24, height: 24, borderRadius: 6, objectFit: "cover" });

/** 24x24 rounded-square initials fallback, used when a team has no logo. */
const teamLogoFallback = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: 24,
	height: 24,
	borderRadius: 6,
	background: primary100,
	color: primary600,
	fontSize: "0.6875rem",
	fontWeight: 700,
	flexShrink: 0,
});

/** 24x24 circular image, used for the viewer's avatar. */
const avatarImage = css({ width: 24, height: 24, borderRadius: 999, objectFit: "cover" });

/** 24x24 circular initials fallback, used when the viewer has no avatar. */
const avatarFallback = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: 24,
	height: 24,
	borderRadius: 999,
	background: neutral[200],
	color: neutral[900],
	fontSize: "0.6875rem",
	fontWeight: 700,
	flexShrink: 0,
	"@media (prefers-color-scheme: dark)": { background: neutral[800], color: neutral[50] },
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
 * Fixed, viewport-relative dropdown panel for the team-picker/user-menu popovers.
 * Native `popover` elements are promoted to the top layer and, unless positioned
 * ourselves, default to `position: fixed` centered in the viewport — they aren't
 * anchored to their trigger (no nearest-positioned-ancestor relationship, since
 * top-layer rendering escapes normal containing-block rules). Since this app is
 * platform-only (no floating-ui/JS positioning), we place the panel near the
 * sidebar's left edge (always at viewport x=0, in both mobile-drawer and
 * desktop-static-column modes) with a fixed `top`/`bottom` offset instead.
 */
function dropdownPanel(edge: { top: number } | { bottom: number }) {
	return css({
		position: "fixed",
		// The UA popover stylesheet defaults [popover] elements to `inset: 0` (plus
		// `margin: auto` for auto-centering). Both `top` and `bottom` must be given
		// explicit values here (one of them "auto") — otherwise the UA's own `top: 0`/
		// `bottom: 0` wins the over-constrained vertical box model against whichever
		// side we didn't set, and our offset is silently ignored.
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

/** Horizontal rule separating the primary nav group from the admin-only group. */
const navDivider = css({
	height: 1,
	margin: "4px 8px",
	border: "none",
	background: neutral[200],
	"@media (prefers-color-scheme: dark)": { background: neutral[800] },
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

namespace AppShell {
	export interface Props {
		team: { id: string; slug: string; name: string; logo: string | null };
		teams: Array<{ id: string; slug: string; name: string; logo: string | null }>;
		viewer: { name: string; email: string; avatar: string };
		isAdmin: boolean;
		toast?: { intent: "success" | "error"; message: string };
		children: RemixNode;
	}
}

export default function AppShell(handle: Handle<AppShell.Props>) {
	return () => {
		let { team, teams, viewer, isAdmin, toast, children } = handle.props;

		let primaryNavItems: Array<{ href: string; label: string; icon: RemixNode }> = [
			{
				href: routes.app.team.dashboard.href({ team: team.slug }),
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

		let teamInitials = team.name.slice(0, 2).toUpperCase();
		let avatarInitials =
			viewer.name
				.split(" ")
				.filter(Boolean)
				.map((part) => part[0])
				.join("")
				.toUpperCase()
				.slice(0, 2) || "?";

		return (
			<div mix={[page]}>
				<header
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: 16,
							padding: "12px 20px",
							borderBottom: `1px solid ${neutral[200]}`,
							"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
						}),
					]}
				>
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
						<strong>Uptime</strong>
						<span mix={[mutedSmall]}>{team.name}</span>
					</div>
				</header>

				<div mix={[css({ display: "flex", flex: 1, minHeight: 0 })]}>
					<nav id="app-sidebar" popover="auto" mix={[sidebarNav]}>
						{teams.length <= 1 ? (
							<div mix={[teamPickerRow]}>
								{team.logo ? (
									<img src={team.logo} alt="" mix={[teamLogoImage]} />
								) : (
									<span mix={[teamLogoFallback]}>{teamInitials}</span>
								)}
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
									{team.logo ? (
										<img src={team.logo} alt="" mix={[teamLogoImage]} />
									) : (
										<span mix={[teamLogoFallback]}>{teamInitials}</span>
									)}
									<span mix={[truncatedLabel]}>{team.name}</span>
									<svg viewBox="0 0 20 20" width={14} height={14} fill="none" aria-hidden="true">
										<path
											d="M6 8l4 4 4-4"
											stroke="currentColor"
											strokeWidth={1.5}
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</button>
								<div id="team-picker-menu" popover="auto" mix={[dropdownPanel({ top: 64 })]}>
									<ul mix={[navList]}>
										{teams.map((t) => (
											<li key={t.id}>
												<a
													href={routes.app.team.dashboard.href({ team: t.slug })}
													mix={[dropdownItem]}
												>
													{t.logo ? (
														<img src={t.logo} alt="" mix={[teamLogoImage]} />
													) : (
														<span mix={[teamLogoFallback]}>{t.name.slice(0, 2).toUpperCase()}</span>
													)}
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

						<ul mix={[navList]}>
							{primaryNavItems.map((item) => (
								<li key={item.href}>
									<a href={item.href} mix={[navLink]}>
										{item.icon}
										<span>{item.label}</span>
									</a>
								</li>
							))}
						</ul>

						{isAdmin && (
							<>
								<hr mix={[navDivider]} />
								<ul mix={[navList]}>
									{adminNavItems.map((item) => (
										<li key={item.href}>
											<a
												href={item.href}
												target={item.target}
												rel={item.target ? "noreferrer" : undefined}
												mix={[navLink]}
											>
												{item.icon}
												<span>{item.label}</span>
											</a>
										</li>
									))}
								</ul>
							</>
						)}

						<div mix={[css({ marginTop: "auto" })]}>
							<button
								type="button"
								commandfor="user-menu"
								command="toggle-popover"
								aria-label="Account menu"
								mix={[menuTriggerButton]}
							>
								{viewer.avatar ? (
									<img src={viewer.avatar} alt="" mix={[avatarImage]} />
								) : (
									<span mix={[avatarFallback]}>{avatarInitials}</span>
								)}
								<span mix={[truncatedLabel]}>{viewer.name}</span>
								<svg viewBox="0 0 20 20" width={14} height={14} fill="none" aria-hidden="true">
									<path
										d="M6 8l4 4 4-4"
										stroke="currentColor"
										strokeWidth={1.5}
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</button>
							<div id="user-menu" popover="auto" mix={[dropdownPanel({ bottom: 76 })]}>
								<a href={routes.app.team.account.href({ team: team.slug })} mix={[dropdownItem]}>
									Account
								</a>
								<a href={routes.logout.index.href()} mix={[dropdownItem]}>
									Sign out
								</a>
							</div>
						</div>
					</nav>

					<main
						mix={[
							css({
								flex: 1,
								padding: 20,
								overflow: "auto",
								minWidth: 0,
								"@media (min-width: 768px)": { padding: 48 },
							}),
						]}
					>
						{children}
					</main>
				</div>

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
