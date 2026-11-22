/**
 * Pinhole's frame: a left rail of destinations (icons on a tablet, icons with names and the
 * wordmark on a wide screen) beside each screen; on a phone, a top bar the screen fills and a
 * tab bar under the thumb. It renders inside the `main` frame, so each screen marks its own place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BookmarkIcon,
	CompassIcon,
	FilmIcon,
	HouseIcon,
	LogOutIcon,
	MenuIcon,
	RotateCcwIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Menu } from "@sdxc/ui";
import { TAB_BAR_BLOCK_SIZE, TabBar } from "@sdxc/ui/app/tab-bar";

import routes from "~/routes/web";

import { PersonAvatar, PinholeMark } from "./art";
import { ME, actionHref, href } from "./data";

/** From here the rail shows beside the screen, and the phone's bars go. */
export const TABLET = "(min-width: 48rem)";

/** From here the rail shows its names and the wordmark. */
export const WIDE = "(min-width: 80rem)";

/** From here a screen has room for a second column beside its main one. */
export const DESKTOP = "(min-width: 64rem)";

/**
 * The height a full-screen page has on a phone, above the tab bar: what the reel feed fills.
 */
export const PHONE_STAGE = `calc(100dvh - ${TAB_BAR_BLOCK_SIZE} - env(safe-area-inset-bottom, 0px))`;

/** Which destination a screen belongs to. */
export type Destination = "home" | "explore" | "reels" | "saved" | "profile" | "none";

/** The destinations in nav order. */
const DESTINATIONS = [
	{ id: "home", label: "Home", page: "", icon: HouseIcon },
	{ id: "explore", label: "Explore", page: "explore", icon: CompassIcon },
	{ id: "reels", label: "Reels", page: "reels", icon: FilmIcon },
	{ id: "saved", label: "Saved", page: "saved", icon: BookmarkIcon },
] as const;

/** The id of the menu behind More. */
const MORE_MENU = "pinhole-more-menu";

/** The id of the same menu on a phone, opened from the profile's top bar. */
export const PHONE_MORE_MENU = "pinhole-phone-more-menu";

/** A quiet 48px row in the rail: the icon alone on a tablet, the icon and its name on a wide screen. */
function railRow() {
	return [
		raw({
			display: "flex",
			alignItems: "center",
			gap: "1rem",
			blockSize: "3rem",
			paddingInline: "0.75rem",
			border: "0",
			borderRadius: "var(--ui-radius-lg)",
			background: "transparent",
			color: "var(--ui-neutral-fg-emphasis)",
			font: "inherit",
			fontSize: "1rem",
			textDecoration: "none",
			cursor: "pointer",
			transition: "background-color 120ms ease",
			"& [data-rail-label]": { display: "none" },
			[`@media ${WIDE}`]: { "& [data-rail-label]": { display: "inline" } },
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
		),
		when("&:active > svg", raw({ transform: "scale(0.92)" })),
		motionReduce(raw({ transition: "none" })),
	];
}

/**
 * The rail: the mark (with the wordmark on a wide screen), each destination, the visitor's
 * profile, and More at the foot with resetting the demo and leaving.
 */
function Rail(handle: Handle<{ current: Destination }>) {
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
						gap: "0.25rem",
						paddingBlock: "1.25rem 1rem",
						paddingInline: "0.75rem",
						borderInlineEnd: "1px solid var(--ui-neutral-border)",
						backgroundColor: "var(--ui-bg)",
						[`@media ${TABLET}`]: { display: "flex" },
						[`@media ${WIDE}`]: { inlineSize: "15rem" },
					}),
				]}
			>
				<a
					href={href()}
					aria-label="Pinhole home"
					data-rmx-prefetch="intent"
					mix={[railRow(), raw({ marginBlockEnd: "1.25rem", blockSize: "3.25rem" })]}
				>
					<PinholeMark size={28} />
					<Wordmark />
				</a>
				<nav aria-label="Primary" mix={[raw({ display: "contents" })]}>
					{DESTINATIONS.map((destination) => {
						let Icon = destination.icon;
						let here = destination.id === current;
						return (
							<a
								href={href(destination.page)}
								aria-current={here ? "page" : undefined}
								data-main-nav={destination.id}
								data-rmx-prefetch="intent"
								title={destination.label}
								mix={[
									railRow(),
									when(
										"&[aria-current='page']",
										raw({ fontWeight: "700", "& svg": { strokeWidth: "2.5" } }),
									),
								]}
							>
								<Icon size={26} strokeWidth={1.75} aria-hidden="true" />
								<span data-rail-label="">{destination.label}</span>
							</a>
						);
					})}
					<a
						href={href(`u/${ME.handle}`)}
						aria-current={current === "profile" ? "page" : undefined}
						data-main-nav="profile"
						data-rmx-prefetch="intent"
						title="Profile"
						mix={[
							railRow(),
							when(
								"&[aria-current='page']",
								raw({
									fontWeight: "700",
									"& [data-person-avatar]": {
										boxShadow: "0 0 0 2px var(--ui-neutral-fg-emphasis)",
									},
								}),
							),
						]}
					>
						<span
							mix={[raw({ display: "inline-grid", inlineSize: "1.625rem", placeItems: "center" })]}
						>
							<PersonAvatar person={ME} size={1.625} />
						</span>
						<span data-rail-label="">Profile</span>
					</a>
				</nav>
				<span mix={[raw({ flex: "1 1 auto" })]} />
				<button
					type="button"
					commandfor={MORE_MENU}
					command="toggle-popover"
					aria-haspopup="menu"
					title="More"
					mix={[railRow()]}
				>
					<MenuIcon size={26} strokeWidth={1.75} aria-hidden="true" />
					<span data-rail-label="">More</span>
				</button>
				<MoreMenu id={MORE_MENU} placement="top-start" />
			</header>
		);
	};
}

/** The product name set in the brand's face, which the wide rail and the phone bar show. */
export function Wordmark() {
	return () => (
		<span
			data-rail-label=""
			mix={[
				raw({
					fontFamily: "var(--pinhole-display)",
					fontSize: "1.5rem",
					fontWeight: "600",
					letterSpacing: "-0.02em",
					lineHeight: "1",
				}),
			]}
		>
			Pinhole
		</span>
	);
}

/**
 * What More holds: the saved posts, putting the demo back as it started, and leaving. Resetting
 * is a post, which works with or without script.
 */
export function MoreMenu(handle: Handle<{ id: string; placement: "top-start" | "bottom-end" }>) {
	return () => {
		let { id, placement } = handle.props;
		return (
			<Menu id={id} placement={placement} aria-label="More">
				<Menu.Item href={href("saved")}>
					<MenuRow icon={<BookmarkIcon size={18} aria-hidden="true" />}>Saved</MenuRow>
				</Menu.Item>
				<Menu.Separator />
				<form method="post" action={actionHref("reset")} mix={[raw({ display: "contents" })]}>
					<Menu.Item type="submit">
						<MenuRow icon={<RotateCcwIcon size={18} aria-hidden="true" />}>Reset the demo</MenuRow>
					</Menu.Item>
				</form>
				<Menu.Item href={routes.showcase.index.href(null, { searchParams: { kind: "demo" } })}>
					<MenuRow icon={<LogOutIcon size={18} aria-hidden="true" />}>Sign out</MenuRow>
				</Menu.Item>
			</Menu>
		);
	};
}

/** A menu row's icon and words, spaced the same in every menu. */
export function MenuRow(handle: Handle<{ icon: RemixNode; children: RemixNode }>) {
	return () => (
		<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })]}>
			{handle.props.icon}
			{handle.props.children}
		</span>
	);
}

namespace PhoneBar {
	export interface Props {
		/** What the bar shows at its start: the wordmark, a handle, a back link. */
		start: RemixNode;
		/** Buttons at its end. */
		end?: RemixNode;
	}
}

/**
 * A phone's top bar, sticky under the status bar and gone where the rail shows: the screen
 * decides what it holds.
 */
export function PhoneBar(handle: Handle<PhoneBar.Props>) {
	return () => {
		let { end, start } = handle.props;
		return (
			<div
				data-slot="pinhole-phone-bar"
				mix={[
					raw({
						position: "sticky",
						insetBlockStart: "0",
						zIndex: "20",
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						blockSize: "3.25rem",
						paddingInline: "1rem 0.5rem",
						backgroundColor: "color-mix(in oklch, var(--ui-bg) 90%, transparent)",
						backdropFilter: "blur(14px)",
						WebkitBackdropFilter: "blur(14px)",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
						[`@media ${TABLET}`]: { display: "none" },
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							flex: "1 1 auto",
							minInlineSize: "0",
						}),
					]}
				>
					{start}
				</div>
				{end}
			</div>
		);
	};
}

/** The phone's tab bar: the four destinations and the visitor's profile. */
function PhoneTabs(handle: Handle<{ current: Destination }>) {
	return () => {
		let { current } = handle.props;
		return (
			<TabBar label="Primary" hideFrom="48rem" showLabels={false}>
				{DESTINATIONS.map((destination) => {
					let Icon = destination.icon;
					return (
						<TabBar.Item
							href={href(destination.page)}
							icon={<Icon size={24} strokeWidth={destination.id === current ? 2.5 : 1.75} />}
							label={destination.label}
							current={destination.id === current}
							data-main-nav={destination.id}
						/>
					);
				})}
				<TabBar.Item
					href={href(`u/${ME.handle}`)}
					icon={<PersonAvatar person={ME} size={1.5} />}
					label="Profile"
					current={current === "profile"}
					data-main-nav="profile"
				/>
			</TabBar>
		);
	};
}

namespace PinholeShell {
	export interface Props {
		current: Destination;
		/** A dark stage, for the reels. */
		dark?: boolean;
		children: RemixNode;
	}
}

/** Lays a screen out beside the rail, above the phone's tab bar. */
export default function PinholeShell(handle: Handle<PinholeShell.Props>) {
	return () => {
		let { children, current, dark = false } = handle.props;
		return (
			<div
				data-slot="pinhole"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						minBlockSize: "100dvh",
						backgroundColor: dark ? "oklch(0.13 0.008 60)" : "var(--ui-bg)",
						color: "var(--ui-neutral-fg-emphasis)",
						fontFamily: "var(--ui-font-sans)",
						[`@media ${TABLET}`]: { gridTemplateColumns: "auto minmax(0, 1fr)" },
					}),
				]}
			>
				<Rail current={current} />
				<main
					id="pinhole-main"
					mix={[raw({ minInlineSize: "0", display: "flex", flexDirection: "column" })]}
				>
					{children}
				</main>
				<PhoneTabs current={current} />
			</div>
		);
	};
}

/**
 * A thin safelight line across the top of the window while a screen or post loads in `main`.
 * It waits a beat before showing, so a fast swap never flashes it, then creeps toward the end
 * until the swap lands; under reduced motion it shows as a steady line.
 */
export function LoadingBar() {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					position: "fixed",
					insetBlockStart: "0",
					insetInline: "0",
					zIndex: "70",
					blockSize: "2px",
					transformOrigin: "0 50%",
					backgroundColor: "var(--ui-color-brand-500)",
					opacity: "0",
					scale: "0 1",
					pointerEvents: "none",
					"@keyframes pinhole-loading": {
						"0%": { opacity: "0", scale: "0 1" },
						"10%": { opacity: "1", scale: "0.15 1" },
						"100%": { opacity: "1", scale: "0.9 1" },
					},
					":root[data-main-loading] &": {
						animation: "pinhole-loading 8s cubic-bezier(0.1, 0.6, 0.2, 1) 150ms both",
					},
				}),
				motionReduce(
					raw({ ":root[data-main-loading] &": { animation: "none", opacity: "1", scale: "1 1" } }),
				),
			]}
		/>
	);
}
