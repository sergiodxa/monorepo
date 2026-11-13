/**
 * Chorus's frame: the left nav (a full column on a wide screen, an icon rail on a tablet),
 * the timeline column in the centre, and the right rail with search, trends and people to
 * follow. A phone gets a top bar, a bottom tab bar and a floating compose button instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BellIcon,
	BookmarkIcon,
	HouseIcon,
	MailIcon,
	PenLineIcon,
	SearchIcon,
	UserIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { HeadingScope, Menu } from "@sdxc/ui";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { TAB_BAR_BLOCK_SIZE, TabBar } from "@sdxc/ui/app/tab-bar";

import { COMPOSE_DIALOG, ComposeDialog } from "~/resources/views/demo-apps/chorus/compose-dialog";
import { ME, NOTIFICATIONS, actionHref, href } from "~/resources/views/demo-apps/chorus/data";
import { HELP_LABELS } from "~/resources/views/demo-apps/chorus/labels";
import { ChorusMark, PersonAvatar } from "~/resources/views/demo-apps/chorus/parts";
import { FollowCard, SearchBox, TrendsCard } from "~/resources/views/demo-apps/chorus/rail";
import DemoAppFrame from "~/resources/views/demo-apps/frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";
import routes from "~/routes/web";

/** The id of the keyboard help sheet. */
const HELP_ID = "chorus-keys";

/** From here the left nav shows, and the phone's bars go. */
export const TABLET = "(min-width: 40rem)";

/** From here the right rail shows beside the timeline. */
const DESKTOP = "(min-width: 64rem)";

/** From here the left nav shows its labels and the full Post button. */
const WIDE = "(min-width: 80rem)";

/** Which destination a screen belongs to. */
export type Destination =
	| "home"
	| "explore"
	| "notifications"
	| "messages"
	| "bookmarks"
	| "profile"
	| "none";

/** The destinations every screen can reach, in nav order. */
const DESTINATIONS = [
	{ id: "home", label: "Home", page: "", icon: HouseIcon, key: "g h" },
	{ id: "explore", label: "Explore", page: "explore", icon: SearchIcon, key: "g e" },
	{
		id: "notifications",
		label: "Notifications",
		page: "notifications",
		icon: BellIcon,
		key: "g n",
	},
	{ id: "messages", label: "Messages", page: "messages", icon: MailIcon, key: "g m" },
	{ id: "bookmarks", label: "Bookmarks", page: "bookmarks", icon: BookmarkIcon, key: "g b" },
	{ id: "profile", label: "Profile", page: `u/${ME.handle}`, icon: UserIcon, key: "g p" },
] as const;

/** Notifications Noor has not opened, which the nav and tab bar badge. */
const UNREAD = NOTIFICATIONS.filter((notification) => notification.unread).length;

/** The keys the help sheet lists beside the nav's own. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Posts",
		shortcuts: [{ keys: "n", label: "New post" }],
	},
];

/** The left nav: the mark, the destinations, the Post button and the account row. */
function LeftNav(handle: Handle<{ current: Destination }>) {
	return () => {
		let { current } = handle.props;
		return (
			<header
				mix={[
					raw({
						display: "none",
						position: "sticky",
						insetBlockStart: "0",
						blockSize: "100dvh",
						boxSizing: "border-box",
						flexDirection: "column",
						alignItems: "center",
						gap: "0.25rem",
						paddingBlock: "0.5rem",
						[`@media ${TABLET}`]: { display: "flex" },
						[`@media ${WIDE}`]: { alignItems: "stretch", paddingInlineEnd: "1rem" },
					}),
				]}
			>
				<a
					href={href()}
					aria-label="Chorus home"
					mix={[
						navRow(),
						raw({
							gap: "0.625rem",
							fontSize: "1.375rem",
							fontWeight: "800",
							letterSpacing: "-0.02em",
						}),
					]}
				>
					<ChorusMark size={30} />
					<span data-nav-label="" aria-hidden="true">
						Chorus
					</span>
				</a>
				<nav aria-label="Primary">
					<ul
						mix={[
							raw({
								display: "grid",
								gap: "0.125rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
						]}
					>
						{DESTINATIONS.map((destination) => {
							let Icon = destination.icon;
							let here = destination.id === current;
							let count = destination.id === "notifications" ? UNREAD : 0;
							return (
								<li>
									<a
										href={href(destination.page)}
										aria-current={here ? "page" : undefined}
										data-main-nav={destination.id}
										title={destination.label}
										data-rmx-prefetch="intent"
										data-shortcut={destination.key}
										data-shortcut-label={`Go to ${destination.label}`}
										data-shortcut-group="Navigation"
										mix={[
											navRow(),
											when(
												"&[aria-current='page']",
												raw({
													fontWeight: "800",
													"& svg": { strokeWidth: "2.6" },
													"& [data-unread]": { display: "none" },
												}),
											),
										]}
									>
										<span mix={[raw({ position: "relative", display: "inline-flex" })]}>
											<Icon size={26} strokeWidth={1.9} aria-hidden="true" />
											{count > 0 ? (
												<span
													data-unread=""
													mix={[
														raw({
															position: "absolute",
															insetBlockStart: "-0.375rem",
															insetInlineEnd: "-0.5rem",
															minInlineSize: "1.125rem",
															blockSize: "1.125rem",
															paddingInline: "0.25rem",
															boxSizing: "border-box",
															borderRadius: "999px",
															fontSize: "0.6875rem",
															fontWeight: "700",
															lineHeight: "1.125rem",
															textAlign: "center",
															color: "white",
															backgroundColor: "var(--ui-brand-bg-solid)",
															boxShadow: "0 0 0 2px var(--ui-bg)",
														}),
													]}
												>
													{count}
												</span>
											) : null}
										</span>
										<span data-nav-label="">
											{destination.label}
											{count > 0 ? (
												<span data-unread="" mix={[srOnly()]}>
													, {count} unread
												</span>
											) : null}
										</span>
									</a>
								</li>
							);
						})}
					</ul>
				</nav>
				<button
					type="button"
					commandfor={COMPOSE_DIALOG}
					command="show-modal"
					data-compose={href("compose")}
					aria-label="New post"
					data-shortcut="n"
					data-shortcut-label="New post"
					data-shortcut-group="Posts"
					mix={[
						raw({
							border: "0",
							font: "inherit",
							cursor: "pointer",
							display: "inline-grid",
							placeItems: "center",
							inlineSize: "3.25rem",
							blockSize: "3.25rem",
							marginBlockStart: "0.75rem",
							borderRadius: "999px",
							color: "white",
							backgroundColor: "var(--ui-brand-bg-solid)",
							fontWeight: "700",
							fontSize: "1.0625rem",
							textDecoration: "none",
							boxShadow: "0 6px 16px -8px var(--ui-color-brand-600)",
							transition: "background-color 120ms",
							[`@media ${WIDE}`]: { inlineSize: "auto", marginInlineEnd: "0.5rem" },
						}),
						when("&:hover", raw({ backgroundColor: "var(--ui-brand-bg-solid-hover)" })),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
						),
						motionReduce(raw({ transition: "none" })),
					]}
				>
					<span mix={[raw({ display: "inline-flex", [`@media ${WIDE}`]: { display: "none" } })]}>
						<PenLineIcon size={22} aria-hidden="true" />
					</span>
					<span mix={[raw({ display: "none", [`@media ${WIDE}`]: { display: "inline" } })]}>
						Post
					</span>
				</button>
				<span mix={[raw({ flex: "1 1 auto" })]} />
				<button
					type="button"
					commandfor="chorus-account"
					command="toggle-popover"
					aria-label={`Account: ${ME.name}`}
					mix={[
						navRow(),
						raw({
							gap: "0.75rem",
							border: "0",
							background: "transparent",
							font: "inherit",
							cursor: "pointer",
							textAlign: "start",
						}),
					]}
				>
					<PersonAvatar person={ME} />
					<span
						data-nav-label=""
						mix={[
							raw({
								display: "none",
								[`@media ${WIDE}`]: { display: "grid" },
								minInlineSize: "0",
								fontSize: "0.9375rem",
								lineHeight: "1.25",
							}),
						]}
					>
						<strong
							mix={[raw({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })]}
						>
							{ME.name}
						</strong>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>@{ME.handle}</span>
					</span>
				</button>
			</header>
		);
	};
}

/** Hides a span from sight while a screen reader still reads it. */
function srOnly() {
	return raw({
		position: "absolute",
		inlineSize: "1px",
		blockSize: "1px",
		overflow: "hidden",
		clipPath: "inset(50%)",
		whiteSpace: "nowrap",
	});
}

/** One row of the left nav: a pill around the icon, and the label once the nav is wide. */
function navRow() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "1.125rem",
			minBlockSize: "3.25rem",
			minInlineSize: "3.25rem",
			boxSizing: "border-box",
			justifyContent: "center",
			paddingInline: "0.75rem",
			borderRadius: "999px",
			color: "var(--ui-neutral-fg-emphasis)",
			fontSize: "1.25rem",
			textDecoration: "none",
			transition: "background-color 120ms",
			"& > [data-nav-label]": { display: "none" },
			[`@media ${WIDE}`]: {
				justifyContent: "flex-start",
				paddingInlineEnd: "1.5rem",
				"& > [data-nav-label]": { display: "inline-grid" },
			},
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
		),
		motionReduce(raw({ transition: "none" })),
	];
}

/** The account menu, from the nav's account row or the phone's avatar. */
function AccountMenu() {
	return () => (
		<Menu id="chorus-account" placement="top-start" aria-label="Account">
			<Menu.Item href={href(`u/${ME.handle}`)}>Profile</Menu.Item>
			<Menu.Item href={href("bookmarks")}>Bookmarks</Menu.Item>
			<Menu.Item commandfor={HELP_ID} command="show-modal">
				Keyboard shortcuts
			</Menu.Item>
			<Menu.Separator />
			<form
				method="post"
				action={actionHref("reset")}
				data-rmx-document=""
				mix={[raw({ display: "contents" })]}
			>
				<Menu.Item type="submit">Reset the demo</Menu.Item>
			</form>
			<Menu.Item href={routes.demos.href()}>Sign out</Menu.Item>
		</Menu>
	);
}

/**
 * The right rail: search, then trends and people to follow as frames over their placeholders.
 * The search box steps aside while Explore, which has its own, is in the main frame.
 */
function RightRail() {
	return () => (
		<aside
			aria-label="Trends and people"
			mix={[
				raw({
					display: "none",
					position: "sticky",
					insetBlockStart: "0",
					alignSelf: "start",
					gap: "1rem",
					paddingBlock: "0.5rem 1.5rem",
					[`@media ${DESKTOP}`]: { display: "grid" },
				}),
			]}
		>
			<div data-rail-search="">
				<SearchBox />
			</div>
			<DemoAppFrame app="chorus" part="rail/trends" fallback={<TrendsCard ghost />} />
			<DemoAppFrame app="chorus" part="rail/follow" fallback={<FollowCard ghost />} />
			<p
				mix={[
					raw({
						margin: "0",
						paddingInline: "1rem",
						fontSize: "0.8125rem",
						lineHeight: "1.5",
						color: "var(--ui-neutral-fg-muted)",
					}),
				]}
			>
				Chorus is an invented network, a demo of{" "}
				<a href={routes.demos.href()} mix={[raw({ color: "inherit" })]}>
					sdxc.dev's components
				</a>
				. Everyone on it is fictional.
			</p>
		</aside>
	);
}

/** The phone's top bar: the account avatar, the mark, and the help key's twin for touch. */
function PhoneBar() {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "2.75rem 1fr 2.75rem",
					alignItems: "center",
					blockSize: "3.25rem",
					paddingInline: "0.75rem",
					[`@media ${TABLET}`]: { display: "none" },
				}),
			]}
		>
			<button
				type="button"
				commandfor="chorus-account"
				command="toggle-popover"
				aria-label={`Account: ${ME.name}`}
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						inlineSize: "2.75rem",
						blockSize: "2.75rem",
						padding: "0",
						border: "0",
						background: "transparent",
						cursor: "pointer",
					}),
				]}
			>
				<PersonAvatar person={ME} size={2} />
			</button>
			<a
				href={href()}
				aria-label="Chorus home"
				mix={[raw({ justifySelf: "center", display: "inline-flex" })]}
			>
				<ChorusMark size={28} />
			</a>
		</div>
	);
}

namespace ChorusShell {
	export interface Props {
		/** The destination the nav marks on first paint; the sync island keeps it current after. */
		current: Destination;
		/** The page path drawn, with its query, which a New post sent without script returns to. */
		page: string;
		/** The column: the `main` frame, or a column drawn in place for a refused post. */
		children: RemixNode;
	}
}

namespace ChorusColumn {
	export interface Props {
		/** The destination the phone's tab bar marks; the shell's nav marks the same one. */
		current: Destination;
		/** The column's sticky header: a title row with a back link, or the feed's tabs. */
		header: RemixNode;
		/** Shows the phone's top bar above the header; detail screens drop it for their back link. */
		phoneBar?: boolean;
		/** Shows the phone's floating compose button. @default true */
		compose?: boolean;
		/** Shows the phone's tab bar; a conversation gives the space to its reply box. @default true */
		tabBar?: boolean;
		children: RemixNode;
	}
}

/**
 * One screen's column: the phone's top bar, the sticky header, the screen, and the phone's tab
 * bar and compose button. It is the content of the `main` frame, so every screen swaps the
 * column while the nav and the rail stay as they are.
 */
export function ChorusColumn(handle: Handle<ChorusColumn.Props>) {
	return () => {
		let {
			children,
			compose = true,
			current,
			header,
			phoneBar = false,
			tabBar = true,
		} = handle.props;
		return (
			<>
				{phoneBar ? <PhoneBar /> : null}
				<div
					data-slot="chorus-header"
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: "0",
							zIndex: "20",
							backgroundColor: "color-mix(in oklch, var(--ui-bg) 86%, transparent)",
							backdropFilter: "blur(14px) saturate(1.5)",
							WebkitBackdropFilter: "blur(14px) saturate(1.5)",
							borderBlockEnd: "1px solid var(--chorus-hairline)",
						}),
					]}
				>
					{header}
				</div>
				<HeadingScope
					level={2}
					mix={[raw({ flex: "1 0 auto", display: "flex", flexDirection: "column" })]}
				>
					{children}
				</HeadingScope>
				{tabBar ? (
					<TabBar label="Primary" hideFrom="40rem" showLabels={false}>
						{DESTINATIONS.filter(
							(destination) => destination.id !== "bookmarks" && destination.id !== "profile",
						).map((destination) => {
							let Icon = destination.icon;
							let here = destination.id === current;
							return (
								<TabBar.Item
									href={href(destination.page)}
									icon={<Icon strokeWidth={here ? 2.6 : 1.9} />}
									label={destination.label}
									current={here}
									count={destination.id === "notifications" && !here ? UNREAD : undefined}
									countLabel={`${UNREAD} unread`}
									data-rmx-prefetch="intent"
								/>
							);
						})}
					</TabBar>
				) : null}
				{compose ? (
					<button
						type="button"
						commandfor={COMPOSE_DIALOG}
						command="show-modal"
						data-compose={href("compose")}
						aria-label="New post"
						data-slot="chorus-fab"
						mix={[
							raw({
								border: "0",
								cursor: "pointer",
								position: "fixed",
								insetInlineEnd: "1rem",
								insetBlockEnd: `calc(${TAB_BAR_BLOCK_SIZE} + env(safe-area-inset-bottom, 0px) + 1rem)`,
								zIndex: "30",
								display: "grid",
								placeItems: "center",
								inlineSize: "3.5rem",
								blockSize: "3.5rem",
								borderRadius: "999px",
								color: "white",
								backgroundColor: "var(--ui-brand-bg-solid)",
								boxShadow:
									"0 10px 24px -10px var(--ui-color-brand-700), 0 2px 6px -2px rgb(0 0 0 / 0.2)",
								transition: "scale 120ms",
								[`@media ${TABLET}`]: { display: "none" },
							}),
							when("&:active", raw({ scale: "0.94" })),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "3px" }),
							),
							motionReduce(raw({ transition: "none" })),
						]}
					>
						<PenLineIcon size={24} aria-hidden="true" />
					</button>
				) : null}
			</>
		);
	};
}

/**
 * Renders the app around one screen's column: the nav, the rail, the account menu and the
 * keyboard help. The `main` frame's wrappers stretch to the column's height, so a short screen
 * still puts a conversation's reply box at the bottom.
 */
export function ChorusShell(handle: Handle<ChorusShell.Props>) {
	return () => {
		let { children, current, page } = handle.props;
		return (
			<div
				data-slot="chorus"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						justifyContent: "center",
						minBlockSize: "100dvh",
						backgroundColor: "var(--ui-bg)",
						color: "var(--ui-neutral-fg-emphasis)",
						fontFamily: "var(--ui-font-sans)",
						"--chorus-hairline": "var(--ui-neutral-border)",
						"&:has([data-main-screen][data-nav='explore']) [data-rail-search]": {
							display: "none",
						},
						[`@media ${TABLET}`]: {
							gridTemplateColumns: "4.5rem minmax(0, 37.5rem)",
							columnGap: "0.5rem",
						},
						[`@media ${DESKTOP}`]: {
							gridTemplateColumns: "4.5rem minmax(0, 37.5rem) 18.5rem",
							columnGap: "1.25rem",
						},
						[`@media ${WIDE}`]: {
							gridTemplateColumns: "16rem 37.5rem 21.5rem",
							columnGap: "1.5rem",
						},
					}),
				]}
			>
				<a
					href="#chorus-main"
					mix={[
						srOnly(),
						when(
							"&:focus",
							raw({
								position: "fixed",
								insetBlockStart: "0.5rem",
								insetInlineStart: "0.5rem",
								zIndex: "60",
								inlineSize: "auto",
								blockSize: "auto",
								clipPath: "none",
								padding: "0.5rem 1rem",
								borderRadius: "999px",
								backgroundColor: "var(--ui-bg)",
								boxShadow: "0 0 0 2px var(--ui-brand-ring)",
							}),
						),
					]}
				>
					Skip to content
				</a>
				<LeftNav current={current} />
				<main
					id="chorus-main"
					mix={[
						raw({
							minInlineSize: "0",
							minBlockSize: "100dvh",
							display: "flex",
							flexDirection: "column",
							"& > [data-main-region], & > [data-main-region] > [data-main-screen]": {
								flex: "1 0 auto",
								display: "flex",
								flexDirection: "column",
							},
							[`@media ${TABLET}`]: { borderInline: "1px solid var(--chorus-hairline)" },
						}),
					]}
				>
					{children}
				</main>
				<RightRail />
				<MainFrameSync root={href()} />
				<AccountMenu />
				<ComposeDialog page={page} />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
			</div>
		);
	};
}
