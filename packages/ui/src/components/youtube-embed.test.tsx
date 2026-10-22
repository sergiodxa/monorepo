// @vitest-environment happy-dom

/**
 * Tests the player's frame: the privacy-enhanced embed URL with its start time, the
 * consumer's accessible name, and the attributes YouTube needs before it plays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vite-plus/test";

import { YouTubeEmbed } from "./youtube-embed.js";

/** The rendered `<iframe>`, parsed so a test reads attributes rather than matching strings. */
async function renderFrame(node: RemixNode) {
	let template = document.createElement("template");
	template.innerHTML = await renderToString(node);
	let frame = template.content.querySelector("iframe");
	if (!frame) throw new Error("The player rendered no iframe");
	return frame;
}

describe("YouTubeEmbed", () => {
	test("loads the video from the privacy-enhanced host under the consumer's title", async () => {
		let frame = await renderFrame(<YouTubeEmbed videoId="o07u1oKE6VA" title="The Remix Way" />);

		expect(frame.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/o07u1oKE6VA");
		expect(frame.getAttribute("title")).toBe("The Remix Way");
		expect(frame.getAttribute("data-slot")).toBe("youtube-embed");
	});

	test("starts at whole seconds, and at the beginning for a start below one", async () => {
		let later = await renderFrame(<YouTubeEmbed videoId="o07u1oKE6VA" start={905.6} title="" />);
		let zero = await renderFrame(<YouTubeEmbed videoId="o07u1oKE6VA" start={0} title="" />);

		expect(later.getAttribute("src")).toBe(
			"https://www.youtube-nocookie.com/embed/o07u1oKE6VA?start=905",
		);
		expect(zero.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/o07u1oKE6VA");
	});

	test("sends the page's origin as referrer, which YouTube requires to play", async () => {
		let frame = await renderFrame(<YouTubeEmbed videoId="o07u1oKE6VA" title="" />);

		expect(frame.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
		expect(frame.hasAttribute("allowfullscreen")).toBe(true);
	});

	test("loads lazily unless the consumer asks for an eager player", async () => {
		let lazy = await renderFrame(<YouTubeEmbed videoId="o07u1oKE6VA" title="" />);
		let eager = await renderFrame(<YouTubeEmbed videoId="o07u1oKE6VA" title="" loading="eager" />);

		expect(lazy.getAttribute("loading")).toBe("lazy");
		expect(eager.getAttribute("loading")).toBe("eager");
	});
});
