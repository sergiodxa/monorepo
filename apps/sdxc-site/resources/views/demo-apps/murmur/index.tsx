/**
 * Murmur, an invented music service: home shelves, search by genre, the listener's library,
 * albums, playlists and artists, and a player that keeps playing while every screen swaps
 * beneath it. Every sound is synthesized in the browser; every cover is drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { DiscIcon } from "@sdxc/icons";
import { HeadingScope, LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { DemoApp, DemoAppRequest } from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import { MAIN_FRAME, MainScreen, mainSource } from "~/resources/views/demo-apps/main-frame";

import type { Destination } from "./shell";
import type { Listener } from "./state";

import ArtistPage from "./artist";
import { GenrePage, LibraryPage, SearchPage, libraryView } from "./browse";
import { AlbumPage, LikedPage, PlaylistPage } from "./collection";
import {
	ALBUMS,
	ARTISTS,
	GENRES,
	PLAYLISTS,
	TRACKS,
	actionHref,
	contextTracks,
	findAlbum,
	findArtist,
	findGenre,
	findPlaylist,
	findTrack,
	href,
} from "./data";
import Home from "./home";
import { Gutter } from "./parts";
import MurmurShell, { SidebarLibrary } from "./shell";
import { isContext, isPersonal, listCookie, nowCookie, readListener, resetCookies } from "./state";
import { MurmurThumbnail } from "./thumbnail";

/** Cobalt at hue 262, the blue of a stage light through haze. */
const BRAND = [
	"oklch(0.97 0.02 262)",
	"oklch(0.93 0.045 262)",
	"oklch(0.87 0.08 262)",
	"oklch(0.78 0.13 262)",
	"oklch(0.68 0.18 262)",
	"oklch(0.58 0.22 262)",
	"oklch(0.5 0.22 263)",
	"oklch(0.43 0.19 264)",
	"oklch(0.36 0.15 265)",
	"oklch(0.29 0.11 266)",
	"oklch(0.21 0.07 267)",
] as const;

/** Paper and ink leaning blue, so the dark scheme reads as night rather than gray. */
const NEUTRAL = [
	"oklch(0.985 0.003 255)",
	"oklch(0.962 0.006 255)",
	"oklch(0.915 0.01 255)",
	"oklch(0.84 0.014 256)",
	"oklch(0.71 0.018 257)",
	"oklch(0.58 0.02 258)",
	"oklch(0.46 0.022 259)",
	"oklch(0.36 0.024 260)",
	"oklch(0.27 0.024 261)",
	"oklch(0.2 0.022 262)",
	"oklch(0.145 0.018 264)",
] as const;

/** A rounded sans for the interface, soft squares for art and pills for every action. */
const TOKENS = {
	"--ui-font-sans":
		"ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
	"--ui-radius-sm": "0.375rem",
	"--ui-radius-md": "0.5rem",
	"--ui-radius-lg": "0.75rem",
	"--ui-video-card-radius": "0.5rem",
} as const;

/** The pages a post may return to, so a post can never send the listener elsewhere. */
const RETURN_PAGES =
	/^(|search|library|liked|album\/[a-z0-9-]+|playlist\/[a-z0-9-]+|artist\/[a-z0-9-]+|genre\/[a-z0-9-]+)(\?[\w=&%.+-]*)?$/;

/** A post that starts a list playing. */
const PLAY_FORM = f.object({
	context: f.field(s.string()),
	track: f.field(s.optional(s.string())),
	shuffle: f.field(s.optional(s.string())),
	back: f.field(s.defaulted(s.string(), "")),
});

/** A post that turns a like, save or follow on or off. */
const TOGGLE_FORM = f.object({
	on: f.field(s.enum_(["true", "false"])),
	item: f.field(s.optional(s.string())),
	back: f.field(s.defaulted(s.string(), "")),
});

/** Every toast a Murmur redirect can name: likes, saves and follows, and a reset. */
const TOASTS: DemoApp["toasts"] = Object.fromEntries([
	...TRACKS.flatMap((track) => [
		[
			`liked-${track.id}`,
			{
				color: "neutral",
				title: "Added to Liked Songs",
				action: undoForm(`like/${track.id}`, { on: "false" }),
			},
		],
		[
			`unliked-${track.id}`,
			{
				color: "neutral",
				title: "Removed from Liked Songs",
				action: undoForm(`like/${track.id}`, { on: "true" }),
			},
		],
	]),
	...[
		...ALBUMS.map((album) => ({ key: `album:${album.id}`, name: album.title })),
		...PLAYLISTS.map((playlist) => ({ key: `playlist:${playlist.id}`, name: playlist.title })),
	].flatMap(({ key, name }) => [
		[
			`saved-${key.replace(":", "-")}`,
			{
				color: "neutral",
				title: `${name} saved to Your Library`,
				action: undoForm("save", { item: key, on: "false" }),
			},
		],
		[
			`unsaved-${key.replace(":", "-")}`,
			{
				color: "neutral",
				title: `${name} removed from Your Library`,
				action: undoForm("save", { item: key, on: "true" }),
			},
		],
	]),
	...ARTISTS.flatMap((artist) => [
		[
			`followed-${artist.id}`,
			{
				color: "neutral",
				title: `Following ${artist.name}`,
				action: undoForm(`follow/${artist.id}`, { on: "false" }),
			},
		],
		[
			`unfollowed-${artist.id}`,
			{
				color: "neutral",
				title: `Unfollowed ${artist.name}`,
				action: undoForm(`follow/${artist.id}`, { on: "true" }),
			},
		],
	]),
	[
		"reset",
		{
			color: "neutral",
			title: "Demo reset",
			description: "Your library and player are back to how they started.",
		},
	],
]);

/** An Undo action posting the opposite toggle, coming back to the library. */
function undoForm(action: string, fields: Record<string, string>) {
	return {
		label: "Undo",
		form: { action: actionHref(action), fields: { ...fields, back: "library" } },
	};
}

/** One Murmur screen: its title, the destination it marks, and its content. */
interface MurmurScreen {
	title: string;
	status?: number;
	current: Destination;
	/** The sidebar library row it marks, such as `album:tidelight`. */
	nav?: string;
	content: RemixNode;
}

/** The app's own 404, inside the shell. */
function NotFound() {
	return () => (
		<Gutter>
			<HeadingScope level={1}>
				<Empty icon={<DiscIcon />}>
					<Empty.Title>This page skipped</Empty.Title>
					<Empty.Description>It may have moved, or the address has a typo.</Empty.Description>
					<Empty.Action>
						<LinkButton href={href()}>Back to home</LinkButton>
					</Empty.Action>
				</Empty>
			</HeadingScope>
		</Gutter>
	);
}

/** The page path and query a screen's posts return to. */
function backOf(request: DemoAppRequest): string {
	let clean = new URL(mainSource(request.url), request.url);
	return `${request.page}${clean.search}`;
}

/** Picks the screen a page path names; every path Murmur lacks gets its own 404 in the shell. */
function route(request: DemoAppRequest, listener: Listener): MurmurScreen {
	let [first = "", second, extra] = request.page.split("/");
	let back = backOf(request);
	let found: MurmurScreen | undefined;
	if (extra === undefined && second !== undefined)
		found = detailScreen(first, second, listener, back);
	if (second === undefined) found = topScreen(request, first, listener, back);
	return found ?? { title: "Not found", status: 404, current: "none", content: <NotFound /> };
}

/** The screens one segment deep: home, search, the library and Liked Songs. */
function topScreen(
	request: DemoAppRequest,
	page: string,
	listener: Listener,
	back: string,
): MurmurScreen | undefined {
	if (page === "") return { title: "Home", current: "home", content: <Home listener={listener} /> };
	if (page === "search") {
		let query = request.url.searchParams.get("q") ?? "";
		return {
			title: query.trim() === "" ? "Search" : `Search: ${query.trim()}`,
			current: "search",
			content: <SearchPage query={query} listener={listener} back={back} />,
		};
	}
	if (page === "library") {
		return {
			title: "Your Library",
			current: "library",
			content: (
				<LibraryPage
					listener={listener}
					view={libraryView(request.url.searchParams.get("view"))}
					back={back}
				/>
			),
		};
	}
	if (page === "liked") {
		return {
			title: "Liked Songs",
			current: "library",
			nav: "liked",
			content: <LikedPage listener={listener} back={back} />,
		};
	}
	return undefined;
}

/** The screens two segments deep: an album, a playlist, an artist or a genre. */
function detailScreen(
	kind: string,
	id: string,
	listener: Listener,
	back: string,
): MurmurScreen | undefined {
	if (kind === "album") {
		let album = findAlbum(id);
		return album === undefined
			? undefined
			: {
					title: album.title,
					current: "none",
					nav: `album:${id}`,
					content: <AlbumPage album={album} listener={listener} back={back} />,
				};
	}
	if (kind === "playlist") {
		let playlist = findPlaylist(id);
		return playlist === undefined
			? undefined
			: {
					title: playlist.title,
					current: "none",
					nav: `playlist:${id}`,
					content: <PlaylistPage playlist={playlist} listener={listener} back={back} />,
				};
	}
	if (kind === "artist") {
		let artist = findArtist(id);
		return artist === undefined
			? undefined
			: {
					title: artist.name,
					current: "none",
					nav: `artist:${id}`,
					content: <ArtistPage artist={artist} listener={listener} back={back} />,
				};
	}
	if (kind === "genre") {
		let genre = findGenre(id);
		return genre === undefined
			? undefined
			: { title: genre.name, current: "search", content: <GenrePage genre={genre} back={back} /> };
	}
	return undefined;
}

/** The page a post returns to: the one it names when it is a Murmur page, else the library. */
function returnTo(back: string, fallback: string): string {
	return RETURN_PAGES.test(back) ? back : fallback;
}

/** Answers a play post: puts the track in the player and goes back. */
function submitPlay(form: FormData, listener: Listener) {
	let parsed = s.parseSafe(PLAY_FORM, form);
	if (!parsed.success || !isContext(parsed.value.context)) return null;
	let { back, context, shuffle, track } = parsed.value;
	let tracks = contextTracks(context, listener.liked);
	let chosen = track !== undefined && findTrack(track) !== undefined ? track : undefined;
	let pick = shuffle === undefined ? tracks[0] : tracks[Math.floor(Math.random() * tracks.length)];
	let id = chosen ?? pick?.id;
	if (id === undefined) return null;
	return { page: returnTo(back, ""), cookies: [nowCookie({ context, track: id })] };
}

/** Every screen a visitor reaches by clicking, so a test can walk each one. */
const SCREENS = [
	"",
	"search",
	"search?q=night",
	"search?q=zzz",
	"library",
	"library?view=playlists",
	"library?view=albums",
	"library?view=artists",
	"liked",
	...ALBUMS.map((album) => `album/${album.id}`),
	...PLAYLISTS.map((playlist) => `playlist/${playlist.id}`),
	...ARTISTS.map((artist) => `artist/${artist.id}`),
	...GENRES.map((genre) => `genre/${genre.id}`),
];

export default {
	name: "Murmur",
	kind: "Music streaming",
	tagline: "Music for every hour.",
	artDirection: "Cobalt on cool paper, drawn covers, rounded type.",
	description:
		"Murmur, an invented music service: home shelves, search by genre, a library, albums, playlists and artists, with a player that keeps playing while you browse.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <MurmurThumbnail />,
	screens: SCREENS,
	cookies: [],
	isPersonal,
	toasts: TOASTS,
	render(request) {
		let listener = readListener(request.cookie);
		let screen = route(request, listener);
		return {
			title: screen.title,
			status: screen.status,
			body: (
				<MurmurShell current={screen.current} src={mainSource(request.url)} listener={listener} />
			),
		};
	},
	frame(part, request) {
		if (part !== "library") return null;
		return <SidebarLibrary listener={readListener(request.cookie)} />;
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let listener = readListener(request.cookie);
		let screen = route(request, listener);
		let key = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		return (
			<MainScreen
				title={screen.title}
				nav={screen.nav ?? screen.current}
				url={request.url}
				toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
			>
				{screen.content}
			</MainScreen>
		);
	},
	submit(page, form, request) {
		let listener = readListener(request.cookie);
		if (page === "reset")
			return { page: "", toast: "reset", cookies: resetCookies(request.cookie) };
		if (page === "play") return submitPlay(form, listener);
		let [first, second, extra] = page.split("/");
		if (extra !== undefined) return null;
		let parsed = s.parseSafe(TOGGLE_FORM, form);
		if (!parsed.success) return null;
		let on = parsed.value.on === "true";
		let back = returnTo(parsed.value.back, "library");
		if (first === "like" && second !== undefined && findTrack(second) !== undefined) {
			return {
				page: back,
				toast: `${on ? "liked" : "unliked"}-${second}`,
				cookies: [listCookie(listener, "liked", second, on)],
			};
		}
		if (first === "follow" && second !== undefined && findArtist(second) !== undefined) {
			return {
				page: back,
				toast: `${on ? "followed" : "unfollowed"}-${second}`,
				cookies: [listCookie(listener, "followed", second, on)],
			};
		}
		let item = parsed.value.item ?? "";
		if (
			first === "save" &&
			second === undefined &&
			/^(album|playlist):[a-z0-9-]+$/.test(item) &&
			isContext(item)
		) {
			return {
				page: back,
				toast: `${on ? "saved" : "unsaved"}-${item.replace(":", "-")}`,
				cookies: [listCookie(listener, "saved", item, on)],
			};
		}
		return null;
	},
} satisfies DemoApp;
