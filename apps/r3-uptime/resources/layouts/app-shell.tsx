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

import { css } from "remix/ui";

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

/** Primary (brand) scale shade used on this page, hue 142. */
const primary600 = "oklch(0.6 0.16 142)";

/** Page-level flex column filling the viewport height. */
const page = css({ display: "flex", flexDirection: "column", minHeight: "100vh" });

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

/** Plain text link, underlined on hover only. */
const link = css({
	color: primary600,
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
	"@media (prefers-color-scheme: dark)": { color: "oklch(0.78 0.16 142)" },
});

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

		let navItems = [
			{ href: routes.app.team.dashboard.href({ team: team.slug }), label: "Dashboard" },
			{ href: routes.app.team.alerts.href({ team: team.slug }), label: "Alerts" },
			{ href: routes.app.team.maintenanceWindows.href({ team: team.slug }), label: "Maintenance" },
			{ href: routes.app.team.statusPages.href({ team: team.slug }), label: "Status pages" },
			{ href: routes.app.team.apiKeys.href({ team: team.slug }), label: "API keys" },
			{ href: routes.app.team.settings.href({ team: team.slug }), label: "Settings" },
			{ href: routes.app.team.account.href({ team: team.slug }), label: "Account" },
		];

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
					<div mix={[row]}>
						<span mix={[mutedSmall]}>{viewer.email}</span>
						<a href={routes.logout.index.href()} mix={[link]}>
							Sign out
						</a>
					</div>
				</header>

				<div mix={[css({ display: "flex", flex: 1, minHeight: 0 })]}>
					{/*
					 * Below the OLD APP's sidebar mobile breakpoint (768px), this is a
					 * native popover — hidden until opened by the button above —
					 * rendered as a fixed, full-height overlay drawer with its own
					 * backdrop, matching the OLD APP's `Sidebar` primitive switching to
					 * an `AriaModalOverlay` sheet on mobile. At ≥768px it resets to a
					 * normal static column, always visible regardless of open/closed
					 * state (the `!important`s are required to beat the UA
					 * stylesheet's `[popover]:not(:popover-open) { display: none }`,
					 * which otherwise wins on specificity).
					 */}
					<nav
						id="app-sidebar"
						popover="auto"
						mix={[
							css({
								position: "fixed",
								top: 0,
								left: 0,
								bottom: 0,
								margin: 0,
								width: "min(80vw, 288px)",
								maxHeight: "100vh",
								padding: "16px 12px",
								border: "none",
								borderRight: `1px solid ${neutral[200]}`,
								background: "#ffffff",
								boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
								"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
								"@media (min-width: 768px)": {
									display: "flex !important",
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
							}),
						]}
					>
						<ul
							mix={[
								css({
									listStyle: "none",
									margin: 0,
									padding: 0,
									display: "flex",
									flexDirection: "column",
									gap: 4,
								}),
							]}
						>
							{navItems.map((item) => (
								<li key={item.href}>
									<a
										href={item.href}
										mix={[
											css({
												display: "block",
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
											}),
										]}
									>
										{item.label}
									</a>
								</li>
							))}
						</ul>
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
