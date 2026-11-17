/**
 * Vesper, an invented streaming service: profiles, a home of shelves under a billboard, series
 * and films by genre, search, My List and a theater player. Always dark, ink-violet with an
 * ember glow; every picture is drawn, and the profile and list live in the visitor's cookies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { LinkButton } from "@sdxc/ui";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { DemoApp, DemoAppRequest } from "~/resources/views/demo-apps";

import { DEMO_APP_TOAST_PARAM } from "~/resources/views/demo-apps";
import {
	MAIN_FRAME,
	MainFrame,
	MainScreen,
	mainSource,
} from "~/resources/views/demo-apps/main-frame";

import type { Destination } from "./shell";

import { Catalogue, GenrePage, MyList, SearchPage } from "./browse";
import {
	GENRES,
	TITLES,
	actionHref,
	findEpisode,
	findGenre,
	findProfile,
	findTitle,
	href,
	visibleTitles,
} from "./data";
import Home from "./home";
import { Blank, Gutter } from "./parts";
import ProfilePicker from "./profiles";
import VesperShell from "./shell";
import { isPersonal, listCookie, profileCookie, readViewer } from "./state";
import { VesperThumbnail } from "./thumbnail";
import TitlePage from "./title";
import WatchPage from "./watch";

/** An ember at hue 45, the warm light of a screen in a dark room. */
const BRAND = [
	"oklch(0.97 0.02 70)",
	"oklch(0.94 0.045 65)",
	"oklch(0.89 0.085 60)",
	"oklch(0.82 0.13 55)",
	"oklch(0.75 0.16 50)",
	"oklch(0.68 0.18 45)",
	"oklch(0.6 0.18 40)",
	"oklch(0.51 0.16 37)",
	"oklch(0.42 0.13 35)",
	"oklch(0.33 0.1 33)",
	"oklch(0.24 0.07 32)",
] as const;

/** Ink leaning violet, with a near-black 950 the posters glow against. */
const NEUTRAL = [
	"oklch(0.985 0.004 300)",
	"oklch(0.955 0.007 300)",
	"oklch(0.9 0.012 298)",
	"oklch(0.82 0.016 296)",
	"oklch(0.7 0.02 294)",
	"oklch(0.58 0.022 292)",
	"oklch(0.46 0.022 292)",
	"oklch(0.36 0.02 292)",
	"oklch(0.26 0.018 292)",
	"oklch(0.19 0.015 293)",
	"oklch(0.125 0.012 295)",
] as const;

/** A humanist sans for the interface, rounded 8px cards and a pill for every action. */
const TOKENS = {
	"--ui-font-sans":
		"'Avenir Next', Avenir, 'Segoe UI Variable Text', 'Segoe UI', ui-sans-serif, system-ui, -apple-system, sans-serif",
	"--ui-radius-sm": "0.25rem",
	"--ui-radius-md": "0.5rem",
	"--ui-radius-lg": "0.625rem",
	"--ui-video-card-radius": "0.5rem",
} as const;

/** The pages a My List post may return to, so a post can never send the visitor elsewhere. */
const RETURN_PAGES =
	/^(|my-list|series|films|search|title\/[a-z-]+|genre\/[a-z-]+)(\?[\w=&%.+-]*)?$/;

/** A My List post: the page to return to, and whether the title goes on or comes off. */
const LIST_FORM = f.object({
	back: f.field(s.defaulted(s.string(), "")),
	on: f.field(s.enum_(["true", "false"])),
});

/** One Vesper screen: its title and status, the frame it draws in, and its content. */
interface VesperScreen {
	title: string;
	status?: number;
	/** The bar destination it marks, or `null` for a screen that draws its own frame. */
	current: Destination | null;
	content: RemixNode;
}

/** Every toast a Vesper redirect can name: a profile switch, and each title on and off the list. */
const TOASTS: DemoApp["toasts"] = Object.fromEntries([
	...TITLES.flatMap((title) => [
		[
			`listed-${title.id}`,
			{
				color: "neutral",
				title: `${title.name} added to My List`,
				action: {
					label: "Undo",
					form: {
						action: actionHref(`title/${title.id}/list`),
						fields: { on: "false", back: "my-list" },
					},
				},
			},
		],
		[
			`unlisted-${title.id}`,
			{
				color: "neutral",
				title: `${title.name} removed from My List`,
				action: {
					label: "Undo",
					form: {
						action: actionHref(`title/${title.id}/list`),
						fields: { on: "true", back: "my-list" },
					},
				},
			},
		],
	]),
	...[
		["profile-noa", "Watching as Noa"],
		["profile-theo", "Watching as Theo"],
		["profile-ines", "Watching as Ines"],
		["profile-kids", "Watching as Kids"],
	].map(([key, title]) => [key, { color: "neutral", title }]),
]);

/** The app's own 404, inside its frame. */
function NotFound() {
	return () => (
		<Gutter>
			<Blank
				level={1}
				title="This title isn't on Vesper"
				action={<LinkButton href={href()}>Back to home</LinkButton>}
			>
				It may have left the catalogue, or the address has a typo.
			</Blank>
		</Gutter>
	);
}

/** The screen a `watch/…` path names, or `undefined` for one Vesper lacks. */
function watchScreen(
	request: DemoAppRequest,
	id: string,
	episode: string | undefined,
): VesperScreen | undefined {
	let viewer = readViewer(request.cookie);
	let title = findTitle(id);
	if (title === undefined || !visibleTitles(viewer.profile).includes(title)) return undefined;
	if (title.kind === "film") {
		if (episode !== undefined) return undefined;
		return {
			title: `Watch ${title.name}`,
			current: null,
			content: <WatchPage viewer={viewer} title={title} playing={undefined} />,
		};
	}
	let [season = 1, number = 1] = (episode ?? "1-1").split("-").map(Number);
	let playing = findEpisode(title, season, number);
	if (playing === undefined) return undefined;
	return {
		title: `${title.name} S${season}:E${number}`,
		current: null,
		content: <WatchPage viewer={viewer} title={title} playing={playing} />,
	};
}

/** The screen a page path under `title/` or `genre/` names. */
function detailScreen(
	request: DemoAppRequest,
	first: string,
	id: string,
): VesperScreen | undefined {
	let viewer = readViewer(request.cookie);
	if (first === "genre") {
		let genre = findGenre(id);
		return genre === undefined
			? undefined
			: {
					title: genre.name,
					current: "none",
					content: <GenrePage viewer={viewer} genre={genre} />,
				};
	}
	let title = findTitle(id);
	if (title === undefined || !visibleTitles(viewer.profile).includes(title)) return undefined;
	let wanted = Number(request.url.searchParams.get("season") ?? "1");
	let season = title.seasons?.find((entry) => entry.number === wanted) ?? title.seasons?.[0];
	return {
		title: title.name,
		current: title.kind === "film" ? "films" : "series",
		content: (
			<TitlePage
				title={title}
				viewer={viewer}
				season={season}
				back={`${request.page}${request.url.search}`}
			/>
		),
	};
}

/**
 * Picks the screen a page path names; every path Vesper lacks gets its own 404 inside the
 * frame, so a mistyped address still shows where the visitor is.
 */
function route(request: DemoAppRequest): VesperScreen {
	let viewer = readViewer(request.cookie);
	let [first = "", second, third, extra] = request.page.split("/");
	let found: VesperScreen | undefined;
	if (extra === undefined && first === "watch" && second !== undefined) {
		found = watchScreen(request, second, third);
	} else if (
		third === undefined &&
		(first === "title" || first === "genre") &&
		second !== undefined
	) {
		found = detailScreen(request, first, second);
	} else if (second === undefined) {
		found = topScreen(request, first, viewer);
	}
	return (
		found ?? {
			title: "Not found",
			status: 404,
			current: "none",
			content: <NotFound />,
		}
	);
}

/** The screens one segment deep: home, the catalogues, search, My List and the profiles. */
function topScreen(
	request: DemoAppRequest,
	page: string,
	viewer: ReturnType<typeof readViewer>,
): VesperScreen | undefined {
	let genre = findGenre(request.url.searchParams.get("genre") ?? "");
	if (page === "") return { title: "Home", current: "home", content: <Home viewer={viewer} /> };
	if (page === "series")
		return {
			title: "Series",
			current: "series",
			content: <Catalogue viewer={viewer} kind="series" genre={genre} />,
		};
	if (page === "films")
		return {
			title: "Films",
			current: "films",
			content: <Catalogue viewer={viewer} kind="film" genre={genre} />,
		};
	if (page === "search") {
		let query = request.url.searchParams.get("q") ?? "";
		return {
			title: query.trim() === "" ? "Search" : `Search: ${query.trim()}`,
			current: "search",
			content: <SearchPage viewer={viewer} query={query} />,
		};
	}
	if (page === "my-list")
		return { title: "My List", current: "my-list", content: <MyList viewer={viewer} /> };
	if (page === "profiles")
		return { title: "Who's watching?", current: null, content: <ProfilePicker viewer={viewer} /> };
	return undefined;
}

/** Every title page, every genre and series filter, so a test can walk each screen. */
const SCREENS = [
	"",
	"profiles",
	"series",
	"films",
	...GENRES.map((genre) => `series?genre=${genre.id}`),
	"films?genre=thriller",
	...GENRES.map((genre) => `genre/${genre.id}`),
	"search",
	"search?q=tide",
	"search?q=documentary",
	"search?q=zzz",
	"my-list",
	...TITLES.map((title) => `title/${title.id}`),
	"title/tidewater?season=2",
	"watch/tidewater/2-3",
	"watch/halcyon-station/1-1",
	"watch/the-quiet-hours",
	"watch/signal-fire",
];

export default {
	name: "Vesper",
	kind: "Streaming service",
	tagline: "Stories for after dark.",
	artDirection: "Ink violet, ember glow, drawn key art.",
	description:
		"Vesper, an invented streaming service: profiles, a home of sideways shelves under a billboard, series with seasons and episodes, search, My List and a theater player.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS, scheme: "dark" },
	thumbnail: () => <VesperThumbnail />,
	screens: SCREENS,
	cookies: [],
	isPersonal,
	toasts: TOASTS,
	render(request) {
		let screen = route(request);
		let viewer = readViewer(request.cookie);
		return {
			title: screen.title,
			status: screen.status,
			body:
				screen.current === null ? (
					screen.content
				) : (
					<VesperShell viewer={viewer} current={screen.current}>
						<MainFrame src={mainSource(request.url)} />
					</VesperShell>
				),
		};
	},
	target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let screen = route(request);
		if (screen.current === null) return null;
		let key = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		return (
			<MainScreen
				title={screen.title}
				nav={screen.current}
				url={request.url}
				toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
			>
				{screen.content}
			</MainScreen>
		);
	},
	submit(page, form, request) {
		let [first, second, third, extra] = page.split("/");
		if (extra !== undefined || second === undefined) return null;
		if (first === "profiles" && third === undefined) {
			let profile = findProfile(second);
			if (profile === undefined) return null;
			return { page: "", toast: `profile-${profile.id}`, cookies: [profileCookie(profile)] };
		}
		if (first === "title" && third === "list") {
			let title = findTitle(second);
			let parsed = s.parseSafe(LIST_FORM, form);
			if (title === undefined || !parsed.success) return null;
			let add = parsed.value.on === "true";
			let back = RETURN_PAGES.test(parsed.value.back) ? parsed.value.back : `title/${title.id}`;
			return {
				page: back,
				toast: `${add ? "listed" : "unlisted"}-${title.id}`,
				cookies: [listCookie(readViewer(request.cookie), title.id, add)],
			};
		}
		return null;
	},
} satisfies DemoApp;
