// @vitest-environment happy-dom

/**
 * Tests that a YouTube URL pasted on its own line in a post renders as a player through
 * the post page's own parse and component map, while a labelled link to a video stays a link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { PostViewModel } from "~/app/http/view-models/post";
import { YouTubeEmbed } from "~/resources/components/youtube-embed";

/** The article body as the post page renders it, parsed so a test queries elements. */
async function renderArticle(content: string) {
	let page = PostViewModel.page(
		{
			postType: "articles",
			post: {
				meta: { title: "The Remix Way", slug: "the-remix-way", content },
				published_at: null,
				created_at: "2026-10-02 00:00:00",
			},
		},
		"https://sergiodxa.com/articles/the-remix-way",
		undefined,
	);
	if (!page.post.document) throw new Error("The article has no document");

	let html = await renderToString(
		<div>{toRemix(page.post.document, { components: { youtube: YouTubeEmbed } })}</div>,
	);
	let template = document.createElement("template");
	template.innerHTML = html;
	return template.content;
}

describe("YouTubeEmbed", () => {
	test("embeds a pasted watch URL from the nocookie host at its start time", async () => {
		let body = await renderArticle(
			"https://www.youtube.com/watch?v=o07u1oKE6VA&t=905s\n\nAround six months ago…",
		);
		let iframe = body.querySelector("iframe");

		expect(iframe?.getAttribute("src")).toBe(
			"https://www.youtube-nocookie.com/embed/o07u1oKE6VA?start=905",
		);
		expect(iframe?.getAttribute("title")).toBe("YouTube video player");
		expect(iframe?.getAttribute("loading")).toBe("lazy");
		expect(iframe?.hasAttribute("allowfullscreen")).toBe(true);
		expect(body.querySelector("a")).toBeNull();
	});

	test("embeds a youtu.be link without a start time", async () => {
		let body = await renderArticle("https://youtu.be/o07u1oKE6VA");

		expect(body.querySelector("iframe")?.getAttribute("src")).toBe(
			"https://www.youtube-nocookie.com/embed/o07u1oKE6VA",
		);
	});

	test("keeps a labelled link to a video as a link", async () => {
		let body = await renderArticle("Watch [the talk](https://youtu.be/o07u1oKE6VA).");

		expect(body.querySelector("iframe")).toBeNull();
		expect(body.querySelector("a")?.getAttribute("href")).toBe("https://youtu.be/o07u1oKE6VA");
	});
});
