/**
 * The library screens in a real browser: Memories, the CG gallery and its lightbox, the music
 * room, the endings list, chapter select and scene replay, each alone over a stored `Persistent`
 * value and from `NovelPlayer`'s extras menu, plus replays and authored exits in the player.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { on } from "remix/component";
import { render } from "remix/component/test";
import * as s from "remix/data-schema";
import { afterEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";

import type { Persistent } from "../persistent.js";

import {
	arc,
	assets,
	cast,
	chapter,
	character,
	createNovel,
	createScene,
	encyclopedia,
	entry,
	lazy,
	scene,
	scenes,
	topic,
} from "../index.js";

import { AudioMixer } from "./audio.js";
import { ChapterSelect, SceneReplay } from "./chapters.js";
import { Characters } from "./characters.js";
import { Encyclopedia } from "./encyclopedia.js";
import { EndingsList } from "./endings.js";
import { Gallery } from "./gallery.js";
import { Memories } from "./memories.js";
import { MusicRoom } from "./music-room.js";
import { NovelPlayer } from "./player.js";
import { DEFAULT_SETTINGS } from "./settings.js";

/** An SVG image as a data URL, so images decode without a server. */
function svg(color: string, width = 320, height = 640): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`,
	)}`;
}

const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** The catalog the screens translate through. */
const MESSAGES = {
	cast: {
		mika: "Mika",
		ren: "Ren",
		kai: "Kai",
		sora: "Sora",
		prefect: "A prefect",
		mikaAbout: "Runs the café by the station.",
		mikaFamily: "Family",
		mikaFamilyBody: "Her aunt left her the café.",
		mikaPast: "Before the café",
		mikaPastBody: "She sailed for three years.",
	},
	chapters: { prologue: "Prologue" },
	titles: { opening: "Opening", cafe: "The café" },
	opening: {
		welcome: "Welcome.",
		hello: "Hello, {$name}!",
		thinking: "I should say something.",
		ask: "Where now?",
		lucky: "At the café.",
	},
	cafe: { stay: "Stay", leave: "Leave" },
	endings: { good: "Good ending", bad: "Bad ending" },
	lore: {
		places: "Places",
		terms: "Terms",
		cafe: "The café",
		cafeMotto: "Coffee by the station.",
		cafeBody: "Opens at dawn.",
		pier: "The pier",
		pierBody: "Where the ferry lands.",
		history: "History",
		historyBody: "Built a century ago.",
		secret: "The secret",
		tab: "A tab",
	},
};

const LORE = encyclopedia({
	places: topic({
		name: "lore.places",
		entries: {
			cafe: entry({
				title: "lore.cafe",
				summary: "lore.cafeMotto",
				body: "lore.cafeBody",
				sections: [{ title: "lore.history", body: "lore.historyBody" }],
				known: true,
			}),
			pier: entry({ title: "lore.pier", body: "lore.pierBody" }),
			secret: entry({ title: "lore.secret" }),
		},
	}),
	terms: topic({ name: "lore.terms", entries: { tab: entry({ title: "lore.tab" }) } }),
});

const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: { opening: scene({ title: "titles.opening" }), cafe: scene({ title: "titles.cafe" }) },
	}),
});

const CAST = cast({
	mika: character({
		name: "cast.mika",
		color: "#e86a92",
		description: "cast.mikaAbout",
		sprites: { smile: svg("pink") },
	}),
});

const ASSETS = assets({
	backgrounds: { room: svg("green", 1600, 900) },
	images: {
		letter: { en: svg("white", 1600, 900), ja: svg("black", 1600, 900) },
		kiss: svg("red", 1600, 900),
	},
	music: { chill: "/music/chill.ogg", theme: "/music/theme.ogg" },
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.room),
	ctx.enter(CAST.mika, { at: "left", expression: "smile" }),
	ctx.narrate("opening.welcome"),
	ctx.introduce(CAST.mika),
	ctx.say(CAST.mika, "opening.hello", { name: "Ada" }),
	ctx.exit(CAST.mika, { transition: "slide" }),
	ctx.narrate("opening.thinking"),
	ctx.choose(
		{
			"cafe.stay": [ctx.goto(SCENES.prologue.cafe)],
			"cafe.leave": [ctx.ending("endings.bad")],
		},
		{ prompt: "opening.ask" },
	),
]);

const CAFE = createScene(SCENES.prologue.cafe, (ctx) => [
	ctx.narrate("opening.lucky"),
	ctx.ending("endings.good"),
]);

/** A novel over the fixture, its café loaded lazily the way an app maps scenes. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		encyclopedia: LORE,
		state: STATE,
		initial: SCENES.prologue.opening,
		voice: ({ speaker, key }) => (speaker === "mika" ? `/voice/${key}.ogg` : undefined),
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(
		SCENES.prologue.cafe,
		lazy(async () => ({ default: CAFE })),
	);
	return novel;
}

/** A reader who read the opening's first two lines and reached the bad ending. */
const STORED: Persistent = {
	seen: {
		"prologue.opening:opening.welcome": {},
		"prologue.opening:opening.hello": { name: "Ada" },
	},
	chosen: ["prologue.opening:cafe.leave"],
	endings: ["endings.bad"],
	chapters: ["prologue"],
	unlocked: {
		images: ["images.letter"],
		music: ["music.chill"],
		sprites: [],
		entries: [],
		bios: [],
	},
	introduced: [],
};

/** A story whose chapters are grouped in two arcs, each chapter holding one titled scene. */
const ARC_SCENES = scenes({
	y1: arc({
		title: "chapters.prologue",
		chapters: {
			ch01: chapter({
				title: "titles.opening",
				scenes: { s1: scene({ title: "titles.opening" }) },
			}),
		},
	}),
	y2: arc({
		title: "titles.cafe",
		chapters: {
			ch02: chapter({ title: "titles.cafe", scenes: { s1: scene({ title: "titles.cafe" }) } }),
		},
	}),
});

/** A novel over {@link ARC_SCENES}, each scene narrating one line. */
function arcFixture() {
	let novel = createNovel({
		scenes: ARC_SCENES,
		cast: CAST,
		state: STATE,
		initial: ARC_SCENES.y1.ch01.s1,
	});
	novel.map(
		ARC_SCENES.y1.ch01.s1,
		createScene(ARC_SCENES.y1.ch01.s1, (ctx) => [ctx.narrate("opening.welcome")]),
	);
	novel.map(
		ARC_SCENES.y2.ch02.s1,
		createScene(ARC_SCENES.y2.ch02.s1, (ctx) => [ctx.narrate("opening.lucky")]),
	);
	return novel;
}

/** A reader who read the first arc's only line. */
const ARC_STORED: Persistent = {
	seen: { "y1.ch01.s1:opening.welcome": {} },
	chosen: [],
	endings: [],
	chapters: ["y1.ch01"],
	unlocked: { images: [], music: [], sprites: [], entries: [], bios: [] },
	introduced: [],
};

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	vi.restoreAllMocks();
});

/** Renders `node` under a translator for `locale`. */
function mount(node: RemixNode, locale = "en"): RenderResult {
	let container = document.createElement("div");
	container.style.width = "960px";
	container.style.height = "540px";
	document.body.append(container);
	let intl = createI18n({ locale, fallbackLanguage: "en", resources: { en: MESSAGES } });
	mounted = render(<IntlProvider intl={intl}>{node}</IntlProvider>, { container });
	return mounted;
}

/** Waits until a screen has read its library. */
async function loaded(result: RenderResult, selector: string): Promise<HTMLElement> {
	await vi.waitFor(() => expect(result.$(selector)!.getAttribute("aria-busy")).toBeNull());
	return result.$(selector)!;
}

describe("Memories", () => {
	test("lists the read lines of reached scenes with their values, speakers and voices", async () => {
		let replayed = vi.fn();
		let result = mount(
			<Memories
				novel={fixture()}
				persistent={STORED}
				mix={on("novel:replay-voice", (event) => {
					event.preventDefault();
					replayed(event.line);
				})}
			/>,
		);
		expect(result.$("[data-novel-memories]")!.textContent).toBe("Loading…");
		let screen = await loaded(result, "[data-novel-memories]");
		expect(screen.querySelector("h3")!.textContent).toBe("Prologue");
		expect(screen.querySelector("h4")!.textContent).toBe("Opening");
		let lines = [...screen.querySelectorAll("li")];
		expect(lines.map((line) => line.textContent)).toEqual(["Welcome.", "MikaHello, Ada!"]);
		expect(lines[0]!.querySelector("button")).toBeNull();
		lines[1]!.querySelector("button")!.click();
		expect(replayed).toHaveBeenCalledWith(
			expect.objectContaining({ key: "opening.hello", voice: "/voice/opening.hello.ogg" }),
		);
	});

	test("plays a voice through its own mixer outside a player unless a listener prevents it", async () => {
		let played = vi.spyOn(AudioMixer.prototype, "playVoice").mockResolvedValue(undefined);
		let prevent = false;
		let result = mount(
			<Memories
				novel={fixture()}
				persistent={STORED}
				mix={on("novel:replay-voice", (event) => {
					if (prevent) event.preventDefault();
				})}
			/>,
		);
		let screen = await loaded(result, "[data-novel-memories]");
		let voice = screen.querySelector<HTMLButtonElement>('[data-key="opening.hello"] button')!;
		voice.click();
		expect(played).toHaveBeenCalledWith("/voice/opening.hello.ogg");
		prevent = true;
		played.mockClear();
		voice.click();
		expect(played).not.toHaveBeenCalled();
	});

	test("opens its scrolling box at the newest line", async () => {
		let result = mount(
			<div data-box="" style={{ blockSize: "40px", overflowY: "auto" }}>
				<Memories novel={fixture()} persistent={STORED} />
			</div>,
		);
		await loaded(result, "[data-novel-memories]");
		let box = result.$("[data-box]")!;

		expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
		await vi.waitFor(() =>
			expect(box.scrollTop).toBeGreaterThanOrEqual(box.scrollHeight - box.clientHeight - 1),
		);
	});

	test("heads the chapters of each arc with the arc's title", async () => {
		let result = mount(<Memories novel={arcFixture()} persistent={ARC_STORED} />);
		let screen = await loaded(result, "[data-novel-memories]");
		let arc = screen.querySelector<HTMLElement>('[data-arc="y1"]')!;
		expect(arc.querySelector("h3")!.textContent).toBe("Prologue");
		expect(arc.querySelector('[data-chapter="y1.ch01"] h4')!.textContent).toBe("Opening");
		expect(arc.querySelector('[data-scene="y1.ch01.s1"] li')!.textContent).toBe("Welcome.");
		expect(screen.querySelector('[data-arc="y2"]')).toBeNull();
	});

	test("lists the chapters of a story without arcs under no arc heading", async () => {
		let result = mount(<Memories novel={fixture()} persistent={STORED} />);
		let screen = await loaded(result, "[data-novel-memories]");
		expect(screen.querySelector("[data-arc]")).toBeNull();
		expect(screen.querySelector(':scope > [data-chapter="prologue"]')).not.toBeNull();
	});

	test("says there is nothing to remember on a first playthrough", async () => {
		let result = mount(<Memories novel={fixture()} persistent={undefined} />);
		let screen = await loaded(result, "[data-novel-memories]");
		expect(screen.textContent).toBe("Nothing to remember yet.");
	});
});

describe("Gallery", () => {
	test("opens an unlocked CG in its locale in a lightbox and shows locked ones as placeholders", async () => {
		let result = mount(<Gallery novel={fixture()} persistent={STORED} />, "ja");
		let screen = await loaded(result, "[data-novel-gallery]");
		let letter = screen.querySelector<HTMLButtonElement>('[data-image="images.letter"] button')!;
		expect(letter.querySelector("img")!.getAttribute("src")).toBe(svg("black", 1600, 900));
		let locked = screen.querySelector('[data-image="images.kiss"]')!;
		expect(locked.querySelector("img, button")).toBeNull();
		expect(locked.textContent).toBe("Locked");

		letter.click();
		let lightbox = result.$("[data-novel-lightbox]") as HTMLDialogElement;
		await vi.waitFor(() => expect(lightbox.open).toBe(true));
		await vi.waitFor(() =>
			expect(lightbox.querySelector("img")?.getAttribute("src")).toBe(svg("black", 1600, 900)),
		);
		await userEvent.keyboard("{Escape}");
		await vi.waitFor(() => expect(lightbox.open).toBe(false));
	});
});

describe("Characters", () => {
	/** A cast of a described character, a known layered one, and one never introduced. */
	let people = cast({
		mika: character({
			name: "cast.mika",
			description: "cast.mikaAbout",
			bio: {
				family: { title: "cast.mikaFamily", body: "cast.mikaFamilyBody", known: true },
				past: { title: "cast.mikaPast", body: "cast.mikaPastBody" },
				sea: { title: "cast.mikaPast", body: "cast.mikaPastBody" },
			},
			sprites: { smile: svg("pink"), sad: svg("blue") },
		}),
		ren: character({
			name: "cast.ren",
			lore: { known: true },
			layers: { body: { school: svg("gray") }, face: { grin: svg("yellow") } },
		}),
		kai: character({ name: "cast.kai", sprites: { neutral: svg("black") } }),
		sora: character({ name: "cast.sora", lore: { known: true }, sprites: { neutral: svg("red") } }),
		prefect: character({
			name: "cast.prefect",
			lore: { listed: false },
			sprites: { neutral: svg("red") },
		}),
	});

	test("lists only who the reader met, leaving out passers-by, and locks every look the stage never drew", async () => {
		let novel = createNovel({
			scenes: SCENES,
			cast: people,
			state: STATE,
			initial: SCENES.prologue.opening,
		});
		let stored = {
			introduced: ["mika", "prefect"],
			unlocked: { sprites: ["mika:sad", "ren:body=school,face=grin"], bios: ["mika:sea"] },
		};
		let result = mount(<Characters novel={novel} persistent={stored} />);
		let screen = await loaded(result, "[data-novel-characters]");
		let entries = [...screen.querySelectorAll<HTMLButtonElement>("[data-character] button")];
		expect(entries.map((entry) => [entry.textContent, entry.disabled])).toEqual([
			["Mika", false],
			["Ren", false],
		]);

		let detail = () => screen.querySelector("[data-novel-character-detail]")!;
		expect(detail().querySelector("h3")!.textContent).toBe("Mika");
		expect(detail().querySelector("[data-novel-character-description]")!.textContent).toBe(
			"Runs the café by the station.",
		);
		let portrait = () =>
			[...detail().querySelectorAll("[data-novel-character-portrait] img")].map((img) =>
				img.getAttribute("src"),
			);
		expect(
			[...detail().querySelectorAll("[data-novel-character-bio]")].map((section) => [
				section.getAttribute("data-novel-character-bio"),
				section.querySelector("h4")!.textContent,
			]),
		).toEqual([
			["family", "1. Family"],
			["sea", "2. Before the café"],
		]);
		expect(portrait()).toEqual([svg("blue")]);
		let looks = [...detail().querySelectorAll("[data-look]")];
		expect(
			looks.map((look) => [look.getAttribute("data-look"), look.querySelector("img") !== null]),
		).toEqual([
			["", false],
			["mika:sad", true],
		]);

		let pressed = detail().querySelector<HTMLElement>("[data-look] button[aria-pressed='true']")!;
		let list = pressed.closest("ul")!;
		let edge = list.getBoundingClientRect();
		let first = list.firstElementChild!.getBoundingClientRect();
		let outline = Number.parseFloat(getComputedStyle(pressed).outlineWidth);
		expect(first.top - outline).toBeGreaterThanOrEqual(edge.top);
		expect(first.left - outline).toBeGreaterThanOrEqual(edge.left);

		entries[1]!.click();
		await vi.waitFor(() => expect(detail().querySelector("h3")!.textContent).toBe("Ren"));
		expect(portrait()).toEqual([svg("gray"), svg("yellow")]);
	});
});

/** The fixture's reader, who also learned the pier. */
const LEARNED = { ...STORED, unlocked: { ...STORED.unlocked, entries: ["places.pier"] } };

describe("Encyclopedia", () => {
	test("pages through the cast, the novel's topics, the CGs and the music", async () => {
		let result = mount(<Encyclopedia novel={fixture()} persistent={LEARNED} />);
		let book = await loaded(result, "[data-novel-encyclopedia]");
		let tabs = [...book.querySelectorAll<HTMLButtonElement>("[data-novel-encyclopedia-page]")];
		expect(tabs.map((tab) => tab.textContent)).toEqual([
			"All entries",
			"Characters",
			"Places",
			"Terms",
			"Gallery",
			"Music room",
		]);
		tabs[4]!.click();
		await vi.waitFor(() => expect(book.querySelector("[data-novel-gallery]")).not.toBeNull());
		tabs[1]!.click();
		await vi.waitFor(() => expect(book.querySelector("[data-novel-characters]")).not.toBeNull());
	});

	test("lists only learned entries, with their topic on the page of every entry", async () => {
		let result = mount(<Encyclopedia novel={fixture()} persistent={LEARNED} />);
		let book = await loaded(result, "[data-novel-encyclopedia]");
		let listed = () => [...book.querySelectorAll("[data-entry]")].map((item) => item.textContent);
		expect(listed()).toEqual(["PlacesThe café", "PlacesThe pier"]);
		let article = () => book.querySelector("[data-novel-encyclopedia-article]")!;
		expect(article().querySelector("[data-novel-encyclopedia-topic]")!.textContent).toBe("Places");
		expect(article().querySelector("h3")!.textContent).toBe("The café");
		expect(article().querySelector("[data-novel-encyclopedia-summary]")!.textContent).toBe(
			"Coffee by the station.",
		);
		expect(article().querySelector("[data-novel-encyclopedia-contents] li")!.textContent).toBe(
			"History",
		);
		expect(article().querySelector("section h4")!.textContent).toBe("1. History");

		await userEvent.fill(book.querySelector("[data-novel-encyclopedia-search]")!, "pier");
		await vi.waitFor(() => expect(listed()).toEqual(["PlacesThe pier"]));
		book.querySelector<HTMLButtonElement>('[data-entry="places.pier"]')!.click();
		await vi.waitFor(() => expect(article().querySelector("h3")!.textContent).toBe("The pier"));
	});

	test("leaves out the gallery and the music room for a novel without images or tracks", async () => {
		let novel = createNovel({
			scenes: SCENES,
			cast: CAST,
			state: STATE,
			initial: SCENES.prologue.opening,
		});
		let result = mount(<Encyclopedia novel={novel} persistent={STORED} />);
		let book = await loaded(result, "[data-novel-encyclopedia]");
		expect(
			[...book.querySelectorAll("[data-novel-encyclopedia-page]")].map((tab) => tab.textContent),
		).toEqual(["Characters"]);
	});

	test("leaves out the page of every entry for a novel without topics", async () => {
		let novel = createNovel({
			scenes: SCENES,
			cast: CAST,
			assets: ASSETS,
			state: STATE,
			initial: SCENES.prologue.opening,
		});
		let result = mount(<Encyclopedia novel={novel} persistent={STORED} />);
		let book = await loaded(result, "[data-novel-encyclopedia]");
		expect(
			[...book.querySelectorAll("[data-novel-encyclopedia-page]")].map((tab) => tab.textContent),
		).toEqual(["Characters", "Gallery", "Music room"]);
		expect(book.querySelector("[data-novel-characters]")).not.toBeNull();
	});

	test("shows only the pages the game picks, in its order", async () => {
		let result = mount(
			<Encyclopedia novel={fixture()} persistent={STORED} pages={["terms", "places"]} />,
		);
		let book = await loaded(result, "[data-novel-encyclopedia]");
		expect(
			[...book.querySelectorAll("[data-novel-encyclopedia-page]")].map((tab) => tab.textContent),
		).toEqual(["Terms", "Places"]);
		expect(book.querySelector("[data-entry]")).toBeNull();
		expect(book.textContent).toContain("Nothing learned yet.");
	});
});

describe("MusicRoom", () => {
	test("plays an unlocked track on the mixer's music channel and stops it", async () => {
		let mixer = new AudioMixer(DEFAULT_SETTINGS.volume);
		let result = mount(<MusicRoom novel={fixture()} persistent={STORED} mixer={mixer} />);
		let screen = await loaded(result, "[data-novel-music-room]");
		expect(screen.querySelector('[data-track="music.theme"] button')).toBeNull();
		expect(screen.querySelector('[data-track="music.theme"]')!.textContent).toBe("Locked");
		let play = screen.querySelector<HTMLButtonElement>('[data-track="music.chill"] button')!;
		expect(screen.querySelector('[data-track="music.chill"] span')!.textContent).toBe("chill");
		play.click();
		expect(mixer.snapshot.music).toBe("music.chill");
		await vi.waitFor(() => expect(play.textContent).toBe("Stop"));
		play.click();
		expect(mixer.snapshot.music).toBeNull();
		mixer.dispose();
	});
});

describe("EndingsList", () => {
	test("counts the endings reached of every ending the scenes hold", async () => {
		let result = mount(<EndingsList novel={fixture()} persistent={STORED} />);
		let screen = await loaded(result, "[data-novel-endings]");
		expect(screen.querySelector("[data-novel-endings-count]")!.textContent).toBe("1 / 2");
		expect([...screen.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
			"Bad ending",
			"???",
		]);
	});
});

describe("ChapterSelect and SceneReplay", () => {
	test("offers reached chapters and scenes, and locks the rest", async () => {
		let chosen = vi.fn<(scene: unknown, scope: string) => void>();
		let result = mount(
			<div mix={on("novel:replay", (event) => chosen(event.scene, event.scope))}>
				<ChapterSelect novel={fixture()} persistent={STORED} />
				<SceneReplay novel={fixture()} persistent={STORED} />
			</div>,
		);
		let chapters = await loaded(result, "[data-novel-chapters]");
		let scenesList = await loaded(result, "[data-novel-scenes]");
		chapters.querySelector<HTMLButtonElement>('[data-name="prologue"] button')!.click();
		expect(chosen).toHaveBeenLastCalledWith(SCENES.prologue.opening, "chapter");
		let cafe = scenesList.querySelector<HTMLButtonElement>('[data-name="prologue.cafe"] button')!;
		expect(cafe.disabled).toBe(true);
		expect(cafe.textContent).toBe("Locked");
		scenesList.querySelector<HTMLButtonElement>('[data-name="prologue.opening"] button')!.click();
		expect(chosen).toHaveBeenLastCalledWith(SCENES.prologue.opening, "scene");
	});

	test("heads each arc's chapters and scenes with its title, locked until one is reached", async () => {
		let chosen = vi.fn<(scene: unknown, scope: string) => void>();
		let result = mount(
			<div mix={on("novel:replay", (event) => chosen(event.scene, event.scope))}>
				<ChapterSelect novel={arcFixture()} persistent={ARC_STORED} />
				<SceneReplay novel={arcFixture()} persistent={ARC_STORED} />
			</div>,
		);
		for (let selector of ["[data-novel-chapters]", "[data-novel-scenes]"]) {
			let screen = await loaded(result, selector);
			let reached = screen.querySelector<HTMLElement>('[data-arc="y1"]')!;
			let locked = screen.querySelector<HTMLElement>('[data-arc="y2"]')!;
			expect(reached.dataset["reached"]).toBe("true");
			expect(reached.querySelector("h3")!.textContent).toBe("Prologue");
			expect(locked.dataset["reached"]).toBe("false");
			expect(locked.querySelector("h3")!.textContent).toBe("Locked");
			expect(locked.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
		}
		let chapters = result.$("[data-novel-chapters]")!;
		chapters
			.querySelector<HTMLButtonElement>('[data-arc="y1"] [data-name="y1.ch01"] button')!
			.click();
		expect(chosen).toHaveBeenLastCalledWith(ARC_SCENES.y1.ch01.s1, "chapter");
		let scenesList = result.$("[data-novel-scenes]")!;
		expect(scenesList.querySelector('[data-arc="y1"] h4')!.textContent).toBe("Opening");
		scenesList.querySelector<HTMLButtonElement>('[data-name="y1.ch01.s1"] button')!.click();
		expect(chosen).toHaveBeenLastCalledWith(ARC_SCENES.y1.ch01.s1, "scene");
		expect(result.$("[data-novel-chapters] > ol")).toBeNull();
	});

	test("lists a story without arcs under no arc heading", async () => {
		let result = mount(
			<div>
				<ChapterSelect novel={fixture()} persistent={STORED} />
				<SceneReplay novel={fixture()} persistent={STORED} />
			</div>,
		);
		let chapters = await loaded(result, "[data-novel-chapters]");
		let scenesList = await loaded(result, "[data-novel-scenes]");
		expect(chapters.querySelector("[data-arc]")).toBeNull();
		expect(chapters.querySelector(':scope > ol [data-name="prologue"]')).not.toBeNull();
		expect(scenesList.querySelector("[data-arc]")).toBeNull();
		expect(scenesList.querySelector(":scope > section > h3")!.textContent).toBe("Prologue");
	});
});

/** Mounts a player over the fixture with instant text. */
function player(props: Partial<NovelPlayer.Props> = {}) {
	let saved = vi.fn();
	let ended = vi.fn();
	let result = mount(
		<NovelPlayer.Default
			novel={fixture()}
			start={{ seed: "extras" }}
			settings={{ textSpeed: 0 }}
			mix={[on("novel:save", saved), on("novel:ending", ended)]}
			{...props}
		/>,
	);
	return {
		result,
		saved,
		ended,
		line: () => result.$("[data-novel-line]")?.textContent ?? null,
		root: () => result.$("[data-novel-player]")!,
		phase: () => result.$("[data-novel-player]")!.dataset["phase"],
		next: () => result.$("[data-novel-surface]")!.click(),
	};
}

/** Waits until the player shows `text` and waits for the reader. */
async function shows(view: ReturnType<typeof player>, text: string): Promise<void> {
	await vi.waitFor(
		() => {
			expect(view.line()).toBe(text);
			expect(view.phase()).toBe("waiting");
		},
		{ timeout: 5000 },
	);
}

/** Opens a library screen from the extras menu and answers its dialog. */
async function openScreen(
	view: ReturnType<typeof player>,
	screen: string,
): Promise<HTMLDialogElement> {
	(view.result.$('[data-action="extras"]') as HTMLButtonElement).click();
	let menu = view.result.$("[data-novel-extras]")!;
	await vi.waitFor(() => expect(menu.matches(":popover-open")).toBe(true));
	menu.querySelector<HTMLButtonElement>(`[data-screen="${screen}"]`)!.click();
	let dialog = view.result.$(
		`#${menu.querySelector(`[data-screen="${screen}"]`)!.getAttribute("commandfor")}`,
	) as HTMLDialogElement;
	await vi.waitFor(() => expect(dialog.open).toBe(true));
	return dialog;
}

describe("NovelPlayer extras", () => {
	test("slides a character out toward the nearer edge as the scene exits it", async () => {
		let view = player();
		await shows(view, "Welcome.");
		view.next();
		await shows(view, "Hello, Ada!");
		view.next();
		await vi.waitFor(() =>
			expect(view.result.$('[data-id="mika"]')?.dataset["exiting"]).toBe("true"),
		);
		let mika = view.result.$('[data-id="mika"]')!;
		expect(view.phase()).toBe("staging");
		await shows(view, "I should say something.");
		expect(getComputedStyle(mika).opacity).toBe("0");
		expect(getComputedStyle(mika).translate).not.toBe("none");
	});

	test("opens the encyclopedia on a speaker from their name, once the story names them", async () => {
		let view = player();
		await shows(view, "Welcome.");
		view.next();
		await shows(view, "Hello, Ada!");
		let name = view.result.$(
			'[data-novel-speaker] button[data-character="mika"]',
		) as HTMLButtonElement;
		name.click();
		await vi.waitFor(() =>
			expect(
				view.result.$("[data-novel-characters] [data-novel-character-detail] h3")?.textContent,
			).toBe("Mika"),
		);
		expect(view.result.$("[data-novel-characters]")!.closest("dialog")!.open).toBe(true);
		expect(
			view.result.$('[data-novel-encyclopedia-page="characters"]')!.getAttribute("aria-selected"),
		).toBe("true");
		expect(view.line()).toBe("Hello, Ada!");
	});

	test("opens Memories from the extras menu with the lines read in this play", async () => {
		let view = player();
		await shows(view, "Welcome.");
		view.next();
		await shows(view, "Hello, Ada!");
		let dialog = await openScreen(view, "memories");
		await vi.waitFor(() =>
			expect([...dialog.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
				"Welcome.",
				"MikaHello, Ada!",
			]),
		);
		dialog.close();
		await vi.waitFor(() => expect(dialog.querySelector("[data-novel-memories]")).toBeNull());
	});

	test("replays a scene without saving, then resumes the play it interrupted", async () => {
		let view = player();
		let onSave = view.saved;
		await shows(view, "Welcome.");
		view.next();
		await shows(view, "Hello, Ada!");
		let dialog = await openScreen(view, "scenes");
		let opening = await vi.waitFor(() => {
			let button = dialog.querySelector<HTMLButtonElement>('[data-name="prologue.opening"] button');
			expect(button?.disabled).toBe(false);
			return button!;
		});
		opening.click();
		await shows(view, "Welcome.");
		expect(dialog.open).toBe(false);
		expect(view.root().dataset["replay"]).toBe("true");
		expect(view.result.$('[data-action="save"]')).toBeNull();
		expect(view.result.$('[data-action="quickSave"]')).toBeNull();
		let before = onSave.mock.calls.length;
		await userEvent.keyboard("q");
		expect(onSave).toHaveBeenCalledTimes(before);

		(view.result.$('[data-action="endReplay"]') as HTMLButtonElement).click();
		await shows(view, "Hello, Ada!");
		expect(view.root().dataset["replay"]).toBe("false");
		await userEvent.keyboard("q");
		expect(onSave).toHaveBeenCalledTimes(before + 1);
		expect(onSave.mock.lastCall?.[0].slot).toBe("quick");
	});

	test("ends a chapter replay at its ending and resumes the interrupted play", async () => {
		let view = player();
		let ended = view.ended;
		await shows(view, "Welcome.");
		let dialog = await openScreen(view, "chapters");
		let prologue = await vi.waitFor(() => {
			let button = dialog.querySelector<HTMLButtonElement>('[data-name="prologue"] button');
			expect(button?.disabled).toBe(false);
			return button!;
		});
		prologue.click();
		await vi.waitFor(() => expect(view.root().dataset["replay"]).toBe("true"));
		await shows(view, "Welcome.");
		view.next();
		await shows(view, "Hello, Ada!");
		view.next();
		await shows(view, "I should say something.");
		view.next();
		await vi.waitFor(() => expect(view.result.$('[data-option="cafe.stay"]')).not.toBeNull(), {
			timeout: 5000,
		});
		(view.result.$('[data-option="cafe.stay"]') as HTMLButtonElement).click();
		await shows(view, "At the café.");
		view.next();
		await shows(view, "Welcome.");
		expect(view.root().dataset["replay"]).toBe("false");
		expect(ended).not.toHaveBeenCalled();
	});

	test("leaves a replay to a listener that prevents the pick's default", async () => {
		let picked = vi.fn<(scene: unknown, scope: string) => void>();
		let view = player({
			mix: [
				on("novel:replay", (event) => {
					event.preventDefault();
					picked(event.scene, event.scope);
				}),
			],
		});
		await shows(view, "Welcome.");
		let dialog = await openScreen(view, "chapters");
		let prologue = await vi.waitFor(() => {
			let button = dialog.querySelector<HTMLButtonElement>('[data-name="prologue"] button');
			expect(button?.disabled).toBe(false);
			return button!;
		});
		prologue.click();
		expect(picked).toHaveBeenCalledWith(SCENES.prologue.opening, "chapter");
		expect(dialog.open).toBe(true);
		expect(view.root().dataset["replay"]).toBe("false");
	});

	test("plays a remembered voice through the mixer unless a listener prevents it", async () => {
		let played = vi.spyOn(AudioMixer.prototype, "playVoice").mockResolvedValue(undefined);
		let prevent = false;
		let heard = vi.fn();
		let view = player({
			mix: [
				on("novel:replay-voice", (event) => {
					heard(event.line.voice);
					if (prevent) event.preventDefault();
				}),
			],
		});
		await shows(view, "Welcome.");
		view.next();
		await shows(view, "Hello, Ada!");
		let dialog = await openScreen(view, "memories");
		let voice = await vi.waitFor(() => {
			let button = dialog.querySelector<HTMLButtonElement>('[data-key="opening.hello"] button');
			expect(button).not.toBeNull();
			return button!;
		});
		played.mockClear();
		voice.click();
		expect(heard).toHaveBeenLastCalledWith("/voice/opening.hello.ogg");
		expect(played).toHaveBeenCalledWith("/voice/opening.hello.ogg");
		prevent = true;
		played.mockClear();
		voice.click();
		expect(heard).toHaveBeenCalledTimes(2);
		expect(played).not.toHaveBeenCalled();
	});
});
