/**
 * Vesper's chrome: a top bar that floats over each screen's hero and darkens as it fills, with
 * the destinations, search and the profile menu; on a phone, the destinations move to a tab
 * bar under the thumb. It renders inside the `main` frame, so a profile switch redraws it too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BellIcon,
	BookmarkIcon,
	ChevronDownIcon,
	ClapperboardIcon,
	HouseIcon,
	PencilIcon,
	SearchIcon,
	TvIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Menu } from "@sdxc/ui";
import { TabBar } from "@sdxc/ui/app/tab-bar";

import routes from "~/routes/web";

import type { Profile } from "./data";
import type { Viewer } from "./state";

import { KeyArt } from "./art";
import { PROFILES, UPDATES, actionHref, findTitle, href, visibleTitles } from "./data";

/** From here the destinations sit in the top bar and the tab bar goes. */
export const WIDE = "(min-width: 48rem)";

/** The top bar's height, which a hero tucks under. */
export const TOP_BAR = "4rem";

/** The page gutter, which the shelves' first cards line up with. */
export const GUTTER = "clamp(1rem, 4vw, 3.5rem)";

/** Which destination a screen belongs to. */
export type Destination = "home" | "series" | "films" | "search" | "my-list" | "none";

/** The destinations in nav order. */
const DESTINATIONS = [
	{ id: "home", label: "Home", page: "", icon: HouseIcon },
	{ id: "series", label: "Series", page: "series", icon: TvIcon },
	{ id: "films", label: "Films", page: "films", icon: ClapperboardIcon },
	{ id: "search", label: "Search", page: "search", icon: SearchIcon },
	{ id: "my-list", label: "My List", page: "my-list", icon: BookmarkIcon },
] as const;

/** The profile menu's id, which the avatar button toggles. */
const PROFILE_MENU = "vesper-profile-menu";

/**
 * Vesper's mark: an evening star over a crescent, drawn in the brand's ember.
 *
 * @param handle Carries the mark's size in pixels.
 */
export function VesperMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 26;
		return (
			<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
				<path
					d="M20.5 5.5a11 11 0 1 0 6 19.6A12.5 12.5 0 0 1 20.5 5.5Z"
					fill="var(--ui-color-brand-500)"
				/>
				<path
					d="m24 4 1.2 2.8L28 8l-2.8 1.2L24 12l-1.2-2.8L20 8l2.8-1.2Z"
					fill="var(--ui-color-brand-200)"
				/>
			</svg>
		);
	};
}

namespace ProfileAvatar {
	export interface Props {
		profile: Profile;
		/** The avatar's side, in rem, or `fill` for the width of its box. Default: `2`. */
		size?: number | "fill";
	}
}

/**
 * A profile's avatar: a rounded tile in its two colours with a simple drawn face, so every
 * profile is told apart by colour and shape at any size.
 */
export function ProfileAvatar(handle: Handle<ProfileAvatar.Props>) {
	return () => {
		let { profile, size = 2 } = handle.props;
		let [from, to] = profile.tones;
		return (
			<span
				aria-hidden="true"
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: "0",
						inlineSize: size === "fill" ? "100%" : `${size}rem`,
						aspectRatio: "1",
						borderRadius: size === "fill" ? "1rem" : `${Math.max(0.375, size * 0.16)}rem`,
						background: `linear-gradient(145deg, ${from}, ${to})`,
						boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.18)",
					}),
				]}
			>
				<svg viewBox="0 0 40 40" width="62%" height="62%">
					{profile.kids ? (
						<>
							<circle cx="14" cy="16" r="3" fill="rgb(0 0 0 / 0.55)" />
							<circle cx="26" cy="16" r="3" fill="rgb(0 0 0 / 0.55)" />
							<path
								d="M11 25q9 9 18 0"
								fill="none"
								stroke="rgb(0 0 0 / 0.55)"
								stroke-width="3"
								stroke-linecap="round"
							/>
						</>
					) : (
						<>
							<rect x="11" y="13" width="5" height="5" rx="2.5" fill="rgb(0 0 0 / 0.5)" />
							<rect x="24" y="13" width="5" height="5" rx="2.5" fill="rgb(0 0 0 / 0.5)" />
							<path
								d="M12 26q8 6 16 0"
								fill="none"
								stroke="rgb(0 0 0 / 0.5)"
								stroke-width="2.6"
								stroke-linecap="round"
							/>
						</>
					)}
				</svg>
			</span>
		);
	};
}

/**
 * The menu behind the avatar: every profile to switch to, each a post that sets the profile and
 * redraws the screen with the bar around it as that profile, then managing them and leaving.
 */
function ProfileMenu(handle: Handle<{ viewer: Viewer }>) {
	return () => {
		let { viewer } = handle.props;
		return (
			<Menu id={PROFILE_MENU} placement="bottom-end" aria-label="Profiles">
				{PROFILES.filter((profile) => profile.id !== viewer.profile.id).map((profile) => (
					<form
						method="post"
						action={actionHref(`profiles/${profile.id}`)}
						mix={[raw({ display: "contents" })]}
					>
						<Menu.Item type="submit">
							<span
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.75rem",
										paddingBlock: "0.125rem",
									}),
								]}
							>
								<ProfileAvatar profile={profile} size={2} />
								{profile.name}
							</span>
						</Menu.Item>
					</form>
				))}
				<Menu.Separator />
				<Menu.Item href={href("profiles")}>
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })]}>
						<PencilIcon aria-hidden="true" size={18} />
						Manage profiles
					</span>
				</Menu.Item>
				<Menu.Item href={href("my-list")}>
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })]}>
						<BookmarkIcon aria-hidden="true" size={18} />
						My List
					</span>
				</Menu.Item>
				<Menu.Separator />
				<Menu.Item href={routes.demos.href()}>Sign out of Vesper</Menu.Item>
			</Menu>
		);
	};
}

/** A destination link in the wide top bar, filled as a pill when current. */
function NavLink(handle: Handle<{ id: string; page: string; label: string; current: boolean }>) {
	return () => {
		let { current, id, label, page } = handle.props;
		return (
			<a
				href={href(page)}
				data-main-nav={id}
				data-rmx-prefetch="intent"
				aria-current={current ? "page" : undefined}
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						blockSize: "2.5rem",
						paddingInline: "1rem",
						borderRadius: "999px",
						fontSize: "0.9375rem",
						fontWeight: "500",
						color: "var(--ui-neutral-fg)",
						textDecoration: "none",
						transition: "color 140ms ease, background-color 140ms ease",
					}),
					when("&:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
					when(
						"&[aria-current='page']",
						raw({
							color: "var(--ui-neutral-fg-emphasis)",
							fontWeight: "650",
							backgroundColor: "rgb(255 255 255 / 0.14)",
						}),
					),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "0" }),
					),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				{label}
			</a>
		);
	};
}

/** A round icon button in the top bar, such as the bell. */
function barIconButton() {
	return [
		raw({
			position: "relative",
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "2.75rem",
			blockSize: "2.75rem",
			padding: "0",
			border: "0",
			borderRadius: "999px",
			color: "var(--ui-neutral-fg-emphasis)",
			background: "transparent",
			cursor: "pointer",
		}),
		when("&:hover", raw({ backgroundColor: "rgb(255 255 255 / 0.1)" })),
		when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "0" })),
	];
}

/** The id of the panel listing what is new, which the bell opens. */
const UPDATES_PANEL = "vesper-updates";

/**
 * The bell and what it opens: the titles that are new or have new episodes for this profile,
 * each with its still, what changed and when, linking to the title. A dot marks the bell while
 * there is anything to see. It opens and closes without script.
 */
function Updates(handle: Handle<{ viewer: Viewer }>) {
	return () => {
		let { viewer } = handle.props;
		let items = UPDATES.filter((update) =>
			visibleTitles(viewer.profile).some((title) => title.id === update.title),
		);
		return (
			<>
				<button
					type="button"
					popovertarget={UPDATES_PANEL}
					aria-label={`What's new, ${items.length} updates`}
					mix={[
						barIconButton(),
						raw({ display: "none", [`@media ${WIDE}`]: { display: "inline-grid" } }),
					]}
				>
					<BellIcon aria-hidden="true" size={22} />
					{items.length === 0 ? null : (
						<span
							aria-hidden="true"
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "0.625rem",
									insetInlineEnd: "0.625rem",
									inlineSize: "0.5rem",
									blockSize: "0.5rem",
									borderRadius: "999px",
									backgroundColor: "var(--ui-color-brand-500)",
									boxShadow: "0 0 0 2px rgb(6 5 10)",
								}),
							]}
						/>
					)}
				</button>
				<div
					id={UPDATES_PANEL}
					popover="auto"
					aria-label="What's new"
					mix={[
						dropPanel(),
						raw({ inlineSize: "min(24rem, calc(100vw - 2rem))", padding: "0.5rem" }),
					]}
				>
					<ul mix={[raw({ display: "grid", margin: "0", padding: "0", listStyle: "none" })]}>
						{items.map((update) => {
							let title = findTitle(update.title)!;
							return (
								<li>
									<a
										href={href(`title/${title.id}`)}
										mix={[
											raw({
												display: "grid",
												gridTemplateColumns: "7.5rem minmax(0, 1fr)",
												alignItems: "center",
												gap: "0.875rem",
												padding: "0.625rem",
												borderRadius: "0.5rem",
												color: "inherit",
												textDecoration: "none",
											}),
											when(
												"&:hover, &:focus-visible",
												raw({ backgroundColor: "rgb(255 255 255 / 0.08)" }),
											),
											when("&:focus-visible", raw({ outline: "2px solid var(--ui-brand-ring)" })),
										]}
									>
										<span
											mix={[
												raw({
													position: "relative",
													aspectRatio: "16 / 9",
													overflow: "clip",
													borderRadius: "0.375rem",
												}),
											]}
										>
											<KeyArt title={title} />
										</span>
										<span mix={[raw({ display: "grid", gap: "0.125rem", lineHeight: "1.3" })]}>
											<strong
												mix={[
													raw({ fontSize: "0.9375rem", color: "var(--ui-neutral-fg-emphasis)" }),
												]}
											>
												{update.what}
											</strong>
											<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg)" })]}>
												{title.name}
											</span>
											<span
												mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
											>
												{update.when}
											</span>
										</span>
									</a>
								</li>
							);
						})}
					</ul>
				</div>
			</>
		);
	};
}

/** The surface a top-bar panel opens on, under its button's end edge. */
function dropPanel() {
	return raw({
		position: "fixed",
		inset: "auto",
		insetBlockStart: `calc(${TOP_BAR} - 0.25rem)`,
		insetInlineEnd: GUTTER,
		margin: "0",
		maxBlockSize: `calc(100dvh - ${TOP_BAR} - 1rem)`,
		overflow: "auto",
		border: "0",
		borderRadius: "0.75rem",
		color: "var(--ui-neutral-fg)",
		backgroundColor: "oklch(0.2 0.012 295)",
		boxShadow: "0 0 0 1px rgb(255 255 255 / 0.08), 0 24px 60px -12px rgb(0 0 0 / 0.75)",
		colorScheme: "dark",
	});
}

/** The wide bar's search box: a plain GET form to the search screen, so it works without script. */
function SearchBox() {
	return () => (
		<form
			method="get"
			action={href("search")}
			role="search"
			mix={[
				raw({
					display: "none",
					position: "relative",
					[`@media ${WIDE}`]: { display: "block" },
				}),
			]}
		>
			<SearchIcon
				aria-hidden="true"
				size={16}
				mix={[
					raw({
						position: "absolute",
						insetInlineStart: "0.75rem",
						insetBlockStart: "50%",
						translate: "0 -50%",
						color: "var(--ui-neutral-fg-muted)",
						pointerEvents: "none",
					}),
				]}
			/>
			<input
				type="search"
				name="q"
				aria-label="Search titles, people and genres"
				placeholder="Titles, people, genres"
				autocomplete="off"
				mix={[
					raw({
						inlineSize: "clamp(11rem, 18vw, 16rem)",
						blockSize: "2.25rem",
						paddingInline: "2.25rem 0.75rem",
						border: "0",
						borderRadius: "999px",
						font: "inherit",
						fontSize: "0.875rem",
						color: "var(--ui-neutral-fg-emphasis)",
						backgroundColor: "rgb(255 255 255 / 0.08)",
						boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.1)",
						transition: "background-color 140ms ease, box-shadow 140ms ease",
						"&::placeholder": { color: "var(--ui-neutral-fg-muted)" },
					}),
					when(
						"&:focus",
						raw({
							outline: "none",
							backgroundColor: "rgb(255 255 255 / 0.12)",
							boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)",
						}),
					),
					motionReduce(raw({ transition: "none" })),
				]}
			/>
		</form>
	);
}

/**
 * The top bar: mark, destinations, search and the avatar that opens the profile menu. It fades
 * from a scrim over the hero to a solid bar as the page scrolls, driven by the scroll itself.
 */
function TopBar(handle: Handle<{ current: Destination; viewer: Viewer }>) {
	return () => {
		let { current, viewer } = handle.props;
		return (
			<header
				data-vesper-bar=""
				mix={[
					raw({
						position: "sticky",
						insetBlockStart: "0",
						zIndex: "20",
						display: "flex",
						alignItems: "center",
						gap: "clamp(0.75rem, 2vw, 2rem)",
						blockSize: TOP_BAR,
						paddingInline: GUTTER,
						isolation: "isolate",
						background:
							"linear-gradient(to bottom, rgb(6 5 10 / 0.88), rgb(6 5 10 / 0.55) 60%, rgb(6 5 10 / 0))",
						"@keyframes vesper-bar-fill": { from: { opacity: "0" }, to: { opacity: "1" } },
						"&::before": {
							content: '""',
							position: "absolute",
							inset: "0",
							zIndex: "-1",
							backgroundColor: "color-mix(in oklch, var(--ui-bg), transparent 6%)",
							boxShadow: "0 1px 0 rgb(255 255 255 / 0.06)",
							opacity: "0",
							animation: "vesper-bar-fill linear both",
							animationTimeline: "scroll(root)",
							animationRange: "0 10rem",
						},
					}),
				]}
			>
				<a
					href={href()}
					aria-label="Vesper home"
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.5rem",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
							fontSize: "1.25rem",
							fontWeight: "700",
							letterSpacing: "0.18em",
							textTransform: "uppercase",
						}),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "4px" }),
						),
					]}
				>
					<VesperMark />
					<span aria-hidden="true">Vesper</span>
				</a>
				<nav
					aria-label="Primary"
					mix={[raw({ display: "none", [`@media ${WIDE}`]: { display: "flex", gap: "0.125rem" } })]}
				>
					{DESTINATIONS.filter((destination) => destination.id !== "search").map((destination) => (
						<NavLink
							id={destination.id}
							page={destination.page}
							label={destination.label}
							current={destination.id === current}
						/>
					))}
				</nav>
				<span mix={[raw({ flex: "1 1 auto" })]} />
				<SearchBox />
				<Updates viewer={viewer} />
				<button
					type="button"
					commandfor={PROFILE_MENU}
					command="toggle-popover"
					aria-label={`Profile: ${viewer.profile.name}`}
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.375rem",
							blockSize: "2.75rem",
							padding: "0 0.25rem",
							border: "0",
							borderRadius: "var(--ui-radius-md)",
							background: "transparent",
							cursor: "pointer",
						}),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "0" }),
						),
					]}
				>
					<ProfileAvatar profile={viewer.profile} size={2} />
					<ChevronDownIcon
						aria-hidden="true"
						size={16}
						mix={[
							raw({
								display: "none",
								color: "var(--ui-neutral-fg)",
								[`@media ${WIDE}`]: { display: "block" },
							}),
						]}
					/>
				</button>
				<ProfileMenu viewer={viewer} />
			</header>
		);
	};
}

namespace VesperShell {
	export interface Props {
		viewer: Viewer;
		/** The destination the bars mark as current. */
		current: Destination;
		/** The screen's content. */
		children: RemixNode;
	}
}

/**
 * Renders a browse screen in Vesper's frame. The main area starts under the top bar, and each
 * screen with a hero pulls it up beneath the bar's gradient.
 */
export default function VesperShell(handle: Handle<VesperShell.Props>) {
	return () => {
		let { children, current, viewer } = handle.props;
		return (
			<div
				data-vesper-shell=""
				mix={[
					raw({
						flex: "1 1 auto",
						display: "flex",
						flexDirection: "column",
						minBlockSize: "100dvh",
						backgroundColor: "var(--ui-bg)",
						"--ui-video-shelf-inset": GUTTER,
						"--ui-video-card-badge-bg": "var(--ui-color-brand-600)",
					}),
				]}
			>
				<a
					href="#vesper-main"
					mix={[
						raw({
							position: "absolute",
							insetBlockStart: "-4rem",
							insetInlineStart: "1rem",
							zIndex: "40",
							padding: "0.5rem 0.75rem",
							borderRadius: "var(--ui-radius-md)",
							backgroundColor: "var(--ui-neutral-bg-solid)",
							color: "var(--ui-neutral-fg-on-solid)",
						}),
						when("&:focus", raw({ insetBlockStart: "1rem" })),
					]}
				>
					Skip to content
				</a>
				<TopBar current={current} viewer={viewer} />
				<main id="vesper-main" mix={[raw({ flex: "1 1 auto", minInlineSize: "0" })]}>
					{children}
				</main>
				<footer
					mix={[
						raw({
							paddingInline: GUTTER,
							paddingBlock: "3rem 2rem",
							fontSize: "0.8125rem",
							lineHeight: "1.5",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					Vesper is an invented streaming service, a demo of{" "}
					<a href={routes.demos.href()} mix={[raw({ color: "inherit" })]}>
						sdxc.dev's components
					</a>
					. Every title, person and picture in it is made up.
				</footer>
				<TabBar label="Primary" hideFrom="48rem">
					{DESTINATIONS.filter((destination) => destination.id !== "films").map((destination) => {
						let Icon = destination.icon;
						return (
							<TabBar.Item
								href={href(destination.page)}
								icon={<Icon />}
								label={destination.label}
								current={destination.id === current}
								data-main-nav={destination.id}
								data-rmx-prefetch="intent"
							/>
						);
					})}
				</TabBar>
			</div>
		);
	};
}

/**
 * A thin ember bar across the top of the window while a screen or post is loading in `main`.
 * It waits a beat before showing, so a fast swap never flashes it, then creeps toward the end
 * until the swap lands; under reduced motion it shows as a steady line.
 */
export function LoadingBar() {
	return () => (
		<span
			aria-hidden="true"
			data-vesper-loading=""
			mix={[
				raw({
					position: "fixed",
					insetBlockStart: "0",
					insetInline: "0",
					zIndex: "60",
					blockSize: "2px",
					transformOrigin: "0 50%",
					backgroundColor: "var(--ui-color-brand-500)",
					boxShadow: "0 0 8px var(--ui-color-brand-500)",
					opacity: "0",
					scale: "0 1",
					pointerEvents: "none",
					"@keyframes vesper-loading": {
						"0%": { opacity: "0", scale: "0 1" },
						"10%": { opacity: "1", scale: "0.15 1" },
						"100%": { opacity: "1", scale: "0.9 1" },
					},
					":root[data-main-loading] &": {
						animation: "vesper-loading 8s cubic-bezier(0.1, 0.6, 0.2, 1) 150ms both",
					},
				}),
				motionReduce(
					raw({
						":root[data-main-loading] &": { animation: "none", opacity: "1", scale: "1 1" },
					}),
				),
			]}
		/>
	);
}
