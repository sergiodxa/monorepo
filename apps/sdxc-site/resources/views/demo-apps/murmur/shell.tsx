/**
 * Murmur's frame, drawn once per visit and never swapped: the sidebar with the destinations and
 * the listener's library, the `main` frame each screen loads into, the player along the foot,
 * and on a phone the tab bar with the mini player riding above it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { HouseIcon, LibraryIcon, RotateCcwIcon, SearchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Menu } from "@sdxc/ui";
import { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { TabBar } from "@sdxc/ui/app/tab-bar";

import DemoAppFrame from "~/resources/views/demo-apps/frame";
import { MainFrame } from "~/resources/views/demo-apps/main-frame";
import { MainFrameSync } from "~/resources/views/demo-apps/main-frame-sync";
import routes from "~/routes/web";

import type { Listener } from "./state";

import { LIKED_ART, albumArt, artistArt, playlistArt } from "./art";
import {
	LISTENER,
	PLAYLISTS,
	SLUG,
	actionHref,
	artistName,
	contextTracks,
	findAlbum,
	findArtist,
	findPlaylist,
	href,
} from "./data";
import { DESKTOP, LIBRARY_FRAME, MurmurPlayer } from "./player";

/** The id of the keyboard help sheet. */
const HELP_ID = "murmur-keys";

/** The id of the account menu. */
const ACCOUNT_MENU = "murmur-account";

/** The keyboard help sheet's strings. */
const HELP_LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

/** The player's keys, which the help sheet lists beside the nav's own. */
const HELP_GROUPS: KeyboardHelp.Group[] = [
	{
		title: "Playback",
		shortcuts: [
			{ keys: "space", label: "Play or pause" },
			{ keys: "shift+arrowright", label: "Next track" },
			{ keys: "shift+arrowleft", label: "Previous track" },
		],
	},
];

/** Which destination a screen belongs to. */
export type Destination = "home" | "search" | "library" | "none";

/** The destinations the sidebar and the tab bar reach. */
const DESTINATIONS = [
	{ id: "home", label: "Home", page: "", icon: HouseIcon, key: "g h" },
	{ id: "search", label: "Search", page: "search", icon: SearchIcon, key: "g s" },
	{ id: "library", label: "Your Library", page: "library", icon: LibraryIcon, key: "g l" },
] as const;

/** Murmur's mark: three rounded bars of a murmur's rise and fall in a brand tile. */
export function MurmurMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 28;
		return (
			<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
				<rect width="32" height="32" rx="9" fill="var(--ui-brand-bg-solid)" />
				<rect x="7.5" y="12" width="4" height="8" rx="2" fill="white" />
				<rect x="14" y="7" width="4" height="18" rx="2" fill="white" />
				<rect x="20.5" y="10" width="4" height="12" rx="2" fill="white" fill-opacity="0.85" />
			</svg>
		);
	};
}

/** The listener's initial in a round brand badge, which opens the account menu. */
function AccountButton() {
	return () => (
		<button
			type="button"
			commandfor={ACCOUNT_MENU}
			command="toggle-popover"
			aria-haspopup="menu"
			aria-label={`Account: ${LISTENER.name}`}
			mix={[
				raw({
					display: "inline-grid",
					placeItems: "center",
					inlineSize: "2.25rem",
					blockSize: "2.25rem",
					padding: "0",
					border: "0",
					borderRadius: "999px",
					font: "inherit",
					fontWeight: "800",
					color: "var(--ui-brand-fg-on-solid, white)",
					backgroundColor: "var(--ui-color-brand-700, var(--ui-brand-bg-solid))",
					cursor: "pointer",
					"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" },
				}),
			]}
		>
			{LISTENER.initials}
		</button>
	);
}

/** The account menu: shortcuts, resetting the demo, and leaving for the gallery. */
function AccountMenu() {
	return () => (
		<Menu id={ACCOUNT_MENU} placement="bottom-end" aria-label="Account">
			<Menu.Item commandfor={HELP_ID} command="show-modal">
				Keyboard shortcuts
			</Menu.Item>
			<form
				method="post"
				action={actionHref("reset")}
				data-main-scroll-top=""
				data-murmur-library=""
				mix={[raw({ display: "contents" })]}
			>
				<Menu.Item type="submit">
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })]}>
						<RotateCcwIcon aria-hidden="true" size={18} />
						Reset the demo
					</span>
				</Menu.Item>
			</form>
			<Menu.Separator />
			<Menu.Item href={routes.showcase.index.href(null, { searchParams: { kind: "demo" } })}>
				Sign out of Murmur
			</Menu.Item>
		</Menu>
	);
}

/** One sidebar destination: icon and label, bold when current. */
function NavItem(handle: Handle<{ destination: (typeof DESTINATIONS)[number]; current: boolean }>) {
	return () => {
		let { current, destination } = handle.props;
		let Icon = destination.icon;
		return (
			<li>
				<a
					href={href(destination.page)}
					data-main-nav={destination.id}
					aria-current={current ? "page" : undefined}
					data-rmx-prefetch="intent"
					data-shortcut={destination.key}
					data-shortcut-label={`Go to ${destination.label}`}
					data-shortcut-group="Navigation"
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "1rem",
							minBlockSize: "2.75rem",
							paddingInline: "0.75rem",
							borderRadius: "var(--ui-radius-md)",
							fontSize: "0.9375rem",
							fontWeight: "700",
							color: "var(--ui-neutral-fg-muted)",
							textDecoration: "none",
							transition: "color 120ms ease",
							"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
							"&[aria-current=page]": { color: "var(--ui-neutral-fg-emphasis)" },
							"&[aria-current=page] svg": { color: "var(--ui-brand-fg)" },
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
						}),
					]}
				>
					<Icon size={22} aria-hidden="true" />
					{destination.label}
				</a>
			</li>
		);
	};
}

/** One row of the sidebar's library: small art, the name and what it is. */
function LibraryRow(
	handle: Handle<{
		page: string;
		nav: string;
		title: string;
		subtitle: string;
		art: string;
		round?: boolean;
	}>,
) {
	return () => {
		let { art, nav, page, round, subtitle, title } = handle.props;
		return (
			<li>
				<a
					href={href(page)}
					data-main-nav={nav}
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.75rem",
							padding: "0.375rem",
							borderRadius: "var(--ui-radius-md)",
							color: "inherit",
							textDecoration: "none",
							"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
							"&[aria-current=page]": { backgroundColor: "var(--ui-neutral-bg-tint-pressed)" },
							"&[aria-current=page] [data-row-title]": { color: "var(--ui-brand-fg)" },
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
							"& > img": {
								flex: "none",
								inlineSize: "2.75rem",
								blockSize: "2.75rem",
								borderRadius: round ? "999px" : "var(--ui-radius-sm)",
							},
						}),
					]}
				>
					<img src={art} alt="" width="44" height="44" loading="lazy" decoding="async" />
					<span mix={[raw({ display: "grid", minInlineSize: "0" })]}>
						<span
							data-row-title=""
							mix={[
								raw({
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontSize: "0.9375rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{title}
						</span>
						<span
							mix={[
								raw({
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{subtitle}
						</span>
					</span>
				</a>
			</li>
		);
	};
}

namespace SidebarLibrary {
	export interface Props {
		listener: Listener;
	}
}

/**
 * The listener's library as the sidebar lists it, the content of its own frame: Liked Songs,
 * their playlists, what they saved, and who they follow.
 */
export function SidebarLibrary(handle: Handle<SidebarLibrary.Props>) {
	return () => {
		let { listener } = handle.props;
		let rows: RemixNode[] = [
			<LibraryRow
				page="liked"
				nav="liked"
				title="Liked Songs"
				subtitle={`Playlist · ${listener.liked.length} songs`}
				art={LIKED_ART}
			/>,
			...PLAYLISTS.filter((playlist) => playlist.mine).map((playlist) => (
				<LibraryRow
					page={`playlist/${playlist.id}`}
					nav={`playlist:${playlist.id}`}
					title={playlist.title}
					subtitle={`Playlist · ${playlist.owner}`}
					art={playlistArt(playlist)}
				/>
			)),
		];
		for (let key of listener.saved) {
			let [kind, id = ""] = key.split(":");
			let album = kind === "album" ? findAlbum(id) : undefined;
			let playlist = kind === "playlist" ? findPlaylist(id) : undefined;
			if (album !== undefined) {
				rows.push(
					<LibraryRow
						page={`album/${id}`}
						nav={key}
						title={album.title}
						subtitle={`Album · ${artistName(album.artist)}`}
						art={albumArt(album)}
					/>,
				);
			}
			if (playlist !== undefined) {
				rows.push(
					<LibraryRow
						page={`playlist/${id}`}
						nav={key}
						title={playlist.title}
						subtitle={`Playlist · ${playlist.owner}`}
						art={playlistArt(playlist)}
					/>,
				);
			}
		}
		for (let id of listener.followed) {
			let artist = findArtist(id);
			if (artist === undefined) continue;
			rows.push(
				<LibraryRow
					page={`artist/${id}`}
					nav={`artist:${id}`}
					title={artist.name}
					subtitle="Artist"
					art={artistArt(artist)}
					round
				/>,
			);
		}
		return (
			<ul
				aria-label="Your Library"
				mix={[
					raw({ display: "grid", gap: "0.125rem", margin: "0", padding: "0", listStyle: "none" }),
				]}
			>
				{rows}
			</ul>
		);
	};
}

namespace MurmurShell {
	export interface Props {
		/** The destination the nav marks on first paint; the sync island keeps it current after. */
		current: Destination;
		/** The `main` frame's source, the screen's own address. */
		src: string;
		listener: Listener;
	}
}

/**
 * Renders the frame around every screen. On a wide screen it is a fixed-height grid whose
 * panels scroll on their own, so the player never moves; on a phone the page scrolls and the
 * tab bar and mini player stay fixed at the foot.
 */
export default function MurmurShell(handle: Handle<MurmurShell.Props>) {
	return () => {
		let { current, listener, src } = handle.props;
		let now = listener.now;
		let initial =
			now === null
				? null
				: { ...now, tracks: contextTracks(now.context, listener.liked).map((track) => track.id) };
		return (
			<div
				data-murmur-shell=""
				mix={[
					raw({
						"--murmur-chrome":
							"color-mix(in oklch, var(--ui-bg, Canvas) 82%, var(--ui-color-neutral-950, black))",
						minBlockSize: "100dvh",
						color: "var(--ui-neutral-fg)",
						backgroundColor: "var(--ui-bg, Canvas)",
						[`@media ${DESKTOP}`]: {
							display: "grid",
							gridTemplateAreas: '"side main" "player player"',
							gridTemplateColumns: "clamp(15rem, 22vw, 20rem) minmax(0, 1fr)",
							gridTemplateRows: "minmax(0, 1fr) auto",
							gap: "0.5rem",
							blockSize: "100dvh",
							paddingBlockStart: "0.5rem",
							paddingInline: "0.5rem",
							boxSizing: "border-box",
							overflow: "hidden",
							backgroundColor: "var(--murmur-chrome)",
						},
					}),
				]}
			>
				<a
					href="#murmur-main"
					mix={[
						raw({
							position: "absolute",
							insetInlineStart: "0.75rem",
							insetBlockStart: "-4rem",
							zIndex: "50",
							padding: "0.5rem 0.875rem",
							borderRadius: "var(--ui-radius-md)",
							color: "var(--ui-brand-fg-on-solid, white)",
							backgroundColor: "var(--ui-brand-bg-solid)",
							"&:focus": { insetBlockStart: "0.75rem" },
						}),
					]}
				>
					Skip to content
				</a>
				<Sidebar current={current} listener={listener} />
				<PhoneBar />
				<main
					id="murmur-main"
					data-murmur-main=""
					mix={[
						raw({
							gridArea: "main",
							minInlineSize: "0",
							paddingBlockEnd: "calc(4.5rem + 3.5rem + env(safe-area-inset-bottom))",
							[`@media ${DESKTOP}`]: {
								paddingBlockEnd: "0",
								overflow: "auto",
								overscrollBehavior: "contain",
								borderRadius: "var(--ui-radius-lg)",
								backgroundColor: "var(--ui-bg, Canvas)",
							},
						}),
					]}
				>
					<MainFrame src={src} />
				</main>
				<MurmurPlayer initial={initial} />
				<TabBar label="Primary" hideFrom="48rem">
					{DESTINATIONS.map((destination) => {
						let Icon = destination.icon;
						return (
							<TabBar.Item
								href={href(destination.page)}
								icon={<Icon />}
								label={destination.id === "library" ? "Library" : destination.label}
								current={destination.id === current}
								data-main-nav={destination.id}
							/>
						);
					})}
				</TabBar>
				<AccountMenu />
				<KeyboardHelp id={HELP_ID} labels={HELP_LABELS} groups={HELP_GROUPS} />
				<MainFrameSync root={href()} />
			</div>
		);
	};
}

/** The wide screen's sidebar: the mark, the destinations, and the library in its own frame. */
function Sidebar(handle: Handle<{ current: Destination; listener: Listener }>) {
	return () => {
		let { current } = handle.props;
		return (
			<aside
				aria-label="Sidebar"
				mix={[
					raw({
						gridArea: "side",
						display: "none",
						minBlockSize: "0",
						[`@media ${DESKTOP}`]: {
							display: "grid",
							gridTemplateRows: "auto minmax(0, 1fr)",
							gap: "0.5rem",
						},
						"& > section": {
							borderRadius: "var(--ui-radius-lg)",
							backgroundColor: "var(--ui-bg, Canvas)",
						},
					}),
				]}
			>
				<section mix={[raw({ display: "grid", gap: "0.25rem", padding: "0.75rem 0.5rem" })]}>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								paddingInline: "0.75rem 0.25rem",
								minBlockSize: "2.75rem",
							}),
						]}
					>
						<a
							href={href()}
							aria-label="Murmur home"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.625rem",
									fontSize: "1.25rem",
									fontWeight: "850",
									letterSpacing: "-0.03em",
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "none",
								}),
							]}
						>
							<MurmurMark />
							<span aria-hidden="true">Murmur</span>
						</a>
						<AccountButton />
					</div>
					<nav aria-label="Primary">
						<ul mix={[raw({ display: "grid", margin: "0", padding: "0", listStyle: "none" })]}>
							{DESTINATIONS.map((destination) => (
								<NavItem destination={destination} current={destination.id === current} />
							))}
						</ul>
					</nav>
				</section>
				<section
					aria-labelledby="murmur-library-heading"
					mix={[
						raw({
							display: "grid",
							gridTemplateRows: "auto minmax(0, 1fr)",
							minBlockSize: "0",
							padding: "0.75rem 0.5rem 0",
						}),
					]}
				>
					<h2
						id="murmur-library-heading"
						mix={[
							raw({
								margin: "0",
								padding: "0.25rem 0.75rem 0.5rem",
								fontSize: "0.9375rem",
								fontWeight: "800",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						Your Library
					</h2>
					<div mix={[raw({ overflow: "auto", minBlockSize: "0", paddingBlockEnd: "0.5rem" })]}>
						<DemoAppFrame
							app={SLUG}
							part="library"
							name={LIBRARY_FRAME}
							fallback={
								<Skeleton.List rows={8} avatar mix={[raw({ paddingInline: "0.375rem" })]} />
							}
						/>
					</div>
				</section>
			</aside>
		);
	};
}

/** The phone's top bar: the mark and the account button, gone once the sidebar shows. */
function PhoneBar() {
	return () => (
		<header
			mix={[
				raw({
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					blockSize: "3.25rem",
					paddingInline: "1rem 0.75rem",
					[`@media ${DESKTOP}`]: { display: "none" },
				}),
			]}
		>
			<a
				href={href()}
				aria-label="Murmur home"
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.5rem",
						fontSize: "1.125rem",
						fontWeight: "850",
						letterSpacing: "-0.03em",
						color: "var(--ui-neutral-fg-emphasis)",
						textDecoration: "none",
					}),
				]}
			>
				<MurmurMark size={26} />
				<span aria-hidden="true">Murmur</span>
			</a>
			<AccountButton />
		</header>
	);
}
