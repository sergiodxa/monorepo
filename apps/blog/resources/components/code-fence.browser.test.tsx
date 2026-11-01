/**
 * Tests that a post's fences draw through the post page's own parse and component map: the
 * lines an annotation marks as added, removed or highlighted, removed lines off the copy
 * target, a malformed annotation dropped, and an unannotated fence left plain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { PostViewModel } from "~/app/http/view-models/post";
import { CodeFence } from "~/resources/components/code-fence";

/** The article body as the post page renders it, mounted so layout and styles apply. */
function renderArticle(content: string): HTMLElement {
	let page = PostViewModel.page(
		{
			postType: "articles",
			post: {
				meta: { title: "Diffs", slug: "diffs", content },
				published_at: null,
				created_at: "2026-10-31 00:00:00",
			},
		},
		"https://sergiodxa.com/articles/diffs",
		undefined,
	);
	if (!page.post.document) throw new Error("The article has no document");

	return render(<div>{toRemix(page.post.document, { components: { code: CodeFence } })}</div>)
		.container;
}

/** Each line's `data-mark`, or `null` for an unmarked line. */
function marks(body: HTMLElement): Array<string | null> {
	return [...body.querySelectorAll("code > [data-line]")].map((line) =>
		line.getAttribute("data-mark"),
	);
}

/** The text the copy button copies: the code without the lines kept off the clipboard. */
function copiedText(body: HTMLElement): string {
	let code = body.querySelector("code")?.cloneNode(true);
	if (!(code instanceof HTMLElement)) throw new Error("No code element");
	for (let excluded of code.querySelectorAll("[data-copy-exclude]")) excluded.remove();
	return code.textContent ?? "";
}

describe("CodeFence", () => {
	test("marks the annotated lines and keeps removed lines off the copy target", () => {
		let body = renderArticle(
			[
				'```ts {% path="vite.config.ts" add={[3]} remove={[2]} highlight={[4]} %}',
				'import { defineConfig } from "vite";',
				"let old = 1;",
				"let added = 2;",
				"export default defineConfig({});",
				"```",
			].join("\n"),
		);

		expect(marks(body)).toEqual([null, "remove", "add", "highlight"]);
		expect(body.querySelector("figcaption")?.textContent).toContain("vite.config.ts");
		expect(body.querySelector("code")?.classList.contains("language-typescript")).toBe(true);
		expect(body.querySelector(".token.keyword")).not.toBeNull();
		expect(copiedText(body)).not.toContain("let old");
		expect(copiedText(body)).toContain("let added = 2;");

		let removed = body.querySelector('[data-mark="remove"]');
		let added = body.querySelector('[data-mark="add"]');
		if (!removed || !added) throw new Error("Missing marked lines");
		expect(getComputedStyle(removed).borderInlineStartWidth).toBe("2px");
		expect(getComputedStyle(added).borderInlineStartWidth).toBe("2px");
		expect(getComputedStyle(removed, "::after").content).toBe('"-"');
		expect(getComputedStyle(added, "::after").content).toBe('"+"');
	});

	test("drops a malformed annotation and still draws the block", () => {
		let body = renderArticle(['```ts {% add="three" %}', "let a = 1;", "```"].join("\n"));

		expect(marks(body)).toEqual([null]);
		expect(body.querySelector("code")?.textContent).toBe("let a = 1;");
	});

	test("draws an unannotated fence with no marks and the language as its header", () => {
		let body = renderArticle(["```diff", "-let a = 1;", "+let a = 2;", "```"].join("\n"));

		expect(marks(body)).toEqual([null, null]);
		expect(body.querySelector("figcaption")?.textContent).toContain("diff");
		expect(body.querySelector(".token.deleted")).not.toBeNull();
		expect(body.querySelector(".token.inserted")).not.toBeNull();
	});
});
