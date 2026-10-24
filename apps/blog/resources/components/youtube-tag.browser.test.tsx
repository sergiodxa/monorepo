/**
 * Tests that a YouTube URL pasted on its own line in a post renders as a player through
 * the post page's own parse and component map, while a labelled link to a video stays a link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { PostViewModel } from "~/app/http/view-models/post";
import { YouTubeTag } from "~/resources/components/youtube-tag";

/**
 * The article body as the post page renders it, mounted into a container outside the
 * document: a detached player keeps its attributes and loads nothing, so no test reaches YouTube.
 */
function renderArticle(content: string): HTMLElement {
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

	return render(<div>{toRemix(page.post.document, { components: { youtube: YouTubeTag } })}</div>, {
		container: document.createElement("div"),
	}).container;
}

describe("YouTubeTag", () => {
	test("embeds a pasted watch URL from the nocookie host at its start time", () => {
		let body = renderArticle(
			"https://www.youtube.com/watch?v=o07u1oKE6VA&t=905s\n\nAround six months ago…",
		);
		let iframe = body.querySelector("iframe");

		expect(iframe?.getAttribute("src")).toBe(
			"https://www.youtube-nocookie.com/embed/o07u1oKE6VA?start=905",
		);
		expect(iframe?.getAttribute("title")).toBe("YouTube video player");
		expect(body.querySelector("a")).toBeNull();
	});

	test("embeds a youtu.be link without a start time", () => {
		let body = renderArticle("https://youtu.be/o07u1oKE6VA");

		expect(body.querySelector("iframe")?.getAttribute("src")).toBe(
			"https://www.youtube-nocookie.com/embed/o07u1oKE6VA",
		);
	});

	test("keeps a labelled link to a video as a link", () => {
		let body = renderArticle("Watch [the talk](https://youtu.be/o07u1oKE6VA).");

		expect(body.querySelector("iframe")).toBeNull();
		expect(body.querySelector("a")?.getAttribute("href")).toBe("https://youtu.be/o07u1oKE6VA");
	});
});
