/**
 * Tests for the `Open` menu's destinations. The assistant links are the ones worth
 * asserting: what is handed over is the page's markdown rather than its HTML, and the
 * prompt travels as a query parameter, so an unencoded one would truncate at the first
 * space and the assistant would open with nothing to read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildOpenLinks } from "~/app/services/open-links";

const MARKDOWN_HREF = "/docs/packages/result.md";
const MARKDOWN_URL = "https://sdxc.sergiodxa.com/docs/packages/result.md";
const SOURCE_URL = "https://github.com/sergiodxa/monorepo/tree/main/packages/result";

describe("buildOpenLinks", () => {
	test("opens on the page's own markdown, by path, so it stays on this host", () => {
		let [first] = buildOpenLinks(MARKDOWN_HREF, MARKDOWN_URL, SOURCE_URL);

		expect(first).toEqual({ label: "View as Markdown", href: MARKDOWN_HREF, external: false });
	});

	test("hands every assistant the markdown URL rather than the page", () => {
		let links = buildOpenLinks(MARKDOWN_HREF, MARKDOWN_URL, SOURCE_URL);
		let assistants = links.filter((link) => link.label.startsWith("Open in "));

		expect(assistants.map((link) => link.label)).toEqual([
			"Open in GitHub",
			"Open in ChatGPT",
			"Open in Claude",
		]);

		for (let link of assistants.slice(1)) {
			let query = new URL(link.href).searchParams.get("q");
			expect(query).toContain(MARKDOWN_URL);
		}
	});

	test("encodes the prompt, so it survives the spaces it is written with", () => {
		let claude = buildOpenLinks(MARKDOWN_HREF, MARKDOWN_URL, SOURCE_URL).find(
			(link) => link.label === "Open in Claude",
		);

		expect(claude?.href).not.toContain(" ");
		expect(claude?.href.startsWith("https://claude.ai/new?q=")).toBe(true);
	});

	test("marks everything off this site as somewhere else", () => {
		let links = buildOpenLinks(MARKDOWN_HREF, MARKDOWN_URL, SOURCE_URL);

		expect(links.filter((link) => link.external)).toHaveLength(3);
	});
});
