/**
 * The café from the "Make your first novel" guide as a playable story: two scenes, one menu and
 * two endings, drawn with inline SVG and played without sound, so the guide's live demo loads
 * nothing beyond the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	assets,
	cast,
	chapter,
	character,
	createNovel,
	createScene,
	scene,
	scenes,
} from "@sdxc/novel";
import * as s from "remix/data-schema";

/** Every line, name and title the story shows, in the reader's only locale. */
export const CAFE_MESSAGES = {
	cast: { mika: "Mika", you: "You" },
	chapters: { prologue: "Prologue" },
	scenes: { opening: "Out of the rain", counter: "At the counter" },
	opening: {
		arrive: "The bell over the door rings as you step in out of the rain.",
		hello: "Welcome in! Sit anywhere you like.",
		ask: "What can I get you?",
		coffee: "Coffee, black",
		cocoa: "A hot cocoa",
		leave: "Nothing, I was just leaving",
	},
	counter: {
		served: "Here you go. That's cup number {$cups} tonight.",
		warm: "You wrap both hands around the mug.",
		smile: "{#b}Come back soon{/b}, okay?",
		quiet: "Mika goes back to her crossword.",
	},
	endings: { rain: "Back into the rain", regular: "A regular" },
} as const;

/** An SVG document as a data URL, which the site's image policy admits. */
function svg(width: number, height: number, body: string): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`,
	)}`;
}

/** A warm wall, a rainy night window and the counter. */
const CAFE = svg(
	1600,
	900,
	`<rect width="1600" height="900" fill="#5b3a29"/>
	<rect x="180" y="110" width="560" height="440" rx="16" fill="#1d2b44"/>
	<g stroke="#8fb3e0" stroke-width="4" stroke-linecap="round" opacity=".55">
		<path d="M250 160l-24 70M380 210l-24 70M520 150l-24 70M640 240l-24 70M300 330l-24 70M470 360l-24 70M600 420l-24 70M360 470l-24 50"/>
	</g>
	<path d="M180 330h560M460 110v440" stroke="#5b3a29" stroke-width="18"/>
	<circle cx="1180" cy="190" r="70" fill="#f6c86b" opacity=".85"/>
	<path d="M1180 60v60" stroke="#2a1a12" stroke-width="6"/>
	<rect y="640" width="1600" height="260" fill="#3a2418"/>
	<rect y="620" width="1600" height="36" fill="#8a5a3c"/>`,
);

/** Mika at her counter, the mouth drawn by the expression. */
function mika(mouth: string): string {
	return svg(
		400,
		800,
		`<path d="M60 800c0-200 60-320 140-320s140 120 140 320z" fill="#e86a92"/>
		<circle cx="200" cy="330" r="120" fill="#f3d2b5"/>
		<path d="M78 330c0-110 60-170 122-170s122 60 122 170c-30-60-70-90-122-90s-92 30-122 90z" fill="#3b2230"/>
		<circle cx="160" cy="335" r="11" fill="#3b2230"/>
		<circle cx="240" cy="335" r="11" fill="#3b2230"/>
		${mouth}`,
	);
}

export const CAFE_SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: {
			opening: scene({ title: "scenes.opening" }),
			counter: scene({ title: "scenes.counter" }),
		},
	}),
});

export const CAFE_CAST = cast({
	mika: character({
		name: "cast.mika",
		color: "#e86a92",
		sprites: {
			smile: mika(`<path d="M170 390q30 24 60 0" stroke="#3b2230" stroke-width="7" fill="none"/>`),
			laugh: mika(`<path d="M165 385q35 50 70 0z" fill="#3b2230"/>`),
		},
	}),
	you: character({ name: "cast.you" }),
});

export const CAFE_ASSETS = assets({ backgrounds: { cafe: CAFE } });

export const CAFE_STATE = s.object({
	cups: s.defaulted(s.number(), 0),
	warmth: s.defaulted(s.number(), 0),
});

declare module "@sdxc/novel" {
	interface NovelTypes {
		state: s.InferOutput<typeof CAFE_STATE>;
		messages: typeof CAFE_MESSAGES;
	}
}

/** The reader arrives, meets Mika and orders, or leaves for the first ending. */
const OPENING = createScene(CAFE_SCENES.prologue.opening, (ctx) => [
	ctx.show(CAFE_ASSETS.backgrounds.cafe, { transition: "fade" }),
	ctx.narrate("opening.arrive"),
	ctx.enter(CAFE_CAST.mika, { at: "center", expression: "smile" }),
	ctx.say(CAFE_CAST.mika, "opening.hello"),
	ctx.choose(
		{
			"opening.coffee": [
				ctx.set("cups", (cups) => cups + 1),
				ctx.goto(CAFE_SCENES.prologue.counter),
			],
			"opening.cocoa": [
				ctx.set("cups", (cups) => cups + 1),
				ctx.set("warmth", (warmth) => warmth + 2),
				ctx.goto(CAFE_SCENES.prologue.counter),
			],
			"opening.leave": [ctx.ending("endings.rain")],
		},
		{ prompt: "opening.ask" },
	),
]);

/** The order arrives; a cocoa earns a laugh before the second ending. */
const COUNTER = createScene(CAFE_SCENES.prologue.counter, (ctx) => [
	ctx.say(CAFE_CAST.mika, "counter.served", (state) => ({ cups: state.cups })),
	ctx.when(
		(state) => state.warmth > 0,
		[
			ctx.say(CAFE_CAST.you, "counter.warm"),
			ctx.express(CAFE_CAST.mika, { expression: "laugh" }),
			ctx.say(CAFE_CAST.mika, "counter.smile"),
		],
		[ctx.narrate("counter.quiet")],
	),
	ctx.exit(CAFE_CAST.mika, { transition: "fade" }),
	ctx.ending("endings.regular"),
]);

/** The café novel, both scenes mapped up front since the story is two short arrays. */
export const CAFE_NOVEL = createNovel({
	scenes: CAFE_SCENES,
	cast: CAFE_CAST,
	assets: CAFE_ASSETS,
	state: CAFE_STATE,
	initial: CAFE_SCENES.prologue.opening,
	messages: { en: CAFE_MESSAGES },
});

CAFE_NOVEL.map(CAFE_SCENES.prologue.opening, OPENING);
CAFE_NOVEL.map(CAFE_SCENES.prologue.counter, COUNTER);
