/**
 * Renders the whole player to HTML inside workerd, the runtime a Cloudflare app server-renders
 * its pages in, which checks every `addEventListener` option's type more strictly than Node.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createI18n } from "@sdxc/i18n";
import { IntlProvider } from "@sdxc/i18n/ui";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";
import { expect, test } from "vitest";

import { assets, createNovel, createScene, scene, scenes } from "../index.js";

import { NovelPlayer } from "./player.js";

const MESSAGES = { opening: { welcome: "Welcome." } };

/** The state shape the package's tests type `NovelTypes` with, though this scene ignores it. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({ opening: scene() });

/** A one-line novel, enough for every part of the default player to render. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		assets: assets({}),
		state: STATE,
		initial: SCENES.opening,
	});
	novel.map(
		SCENES.opening,
		createScene(SCENES.opening, (ctx) => [ctx.narrate("opening.welcome")]),
	);
	return novel;
}

test("server-renders the default player on Cloudflare Workers", async () => {
	let intl = createI18n({ locale: "en", fallbackLanguage: "en", resources: { en: MESSAGES } });

	let html = await renderToString(
		<IntlProvider intl={intl}>
			<NovelPlayer.Default novel={fixture()} />
		</IntlProvider>,
	);

	expect(html).toContain("data-novel-player");
	expect(html).toContain("data-novel-stage");
});
