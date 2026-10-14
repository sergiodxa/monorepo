/**
 * Covers the option group a `code-tabs` strip may name: which tab a document opens
 * on, and what the vocabulary accepts as a name. A strip is authored in markdown, so
 * the reader's pick has to reach it through the document rather than through props,
 * and these render the document to check that it did.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { renderToStream } from "remix/component/server";
import { describe, expect, test } from "vitest";

import type { OptionSelections } from "~/app/services/option-groups";

import { readContent } from "~/app/services/content";
import { parseOptionSelections } from "~/app/services/option-groups";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import OptionGroupScope from "~/resources/components/option-groups";

/** A strip of two tabs, named or not, written the way a content file writes one. */
function strip(attributes: string): string {
	return [
		`<code-tabs${attributes}>`,
		'<code-tab label="npm">',
		"",
		"`npm add @sdxc/result`",
		"",
		"</code-tab>",
		'<code-tab label="bun" selected>',
		"",
		"`bun add @sdxc/result`",
		"",
		"</code-tab>",
		"</code-tabs>",
	].join("\n");
}

/**
 * Renders one content file for a reader.
 *
 * @param source - The markdown to render.
 * @param selections - The option the reader picked in each group.
 * @returns The rendered HTML.
 */
async function render(source: string, selections: OptionSelections): Promise<string> {
	let content = readContent(source);
	if (isFailure(content)) throw content.error;

	let node = (
		<OptionGroupScope selections={selections}>
			{toRemix(content.data, { components: LANDING_COMPONENTS })}
		</OptionGroupScope>
	);

	return await new Response(renderToStream(node)).text();
}

/**
 * The tab standing for one option, as the document rendered it.
 *
 * @param html - The rendered document.
 * @param label - The tab's label.
 * @returns The `input` element's markup.
 */
function tab(html: string, label: string): string {
	let match = html.match(new RegExp(`<input[^>]*data-option-value="${label}"[^>]*>`));
	expect(match).not.toBeNull();
	return match?.[0] ?? "";
}

describe("a code-tabs strip naming an option group", () => {
	test("opens on the option the reader picked elsewhere", async () => {
		let html = await render(
			strip(' name="package-manager"'),
			parseOptionSelections("package-manager:npm"),
		);

		expect(tab(html, "npm")).toContain("checked");
		expect(tab(html, "bun")).not.toContain("checked");
	});

	test("opens on the group's first option for a reader who has picked nothing", async () => {
		let html = await render(strip(' name="package-manager"'), parseOptionSelections(null));

		expect(tab(html, "npm")).toContain("checked");
	});

	test("is a parse error for a group this site does not offer", () => {
		expect(isFailure(readContent(strip(' name="editor"')))).toBe(true);
	});
});

describe("a code-tabs strip naming nothing", () => {
	test("opens on the tab the author marked, whatever the reader picked", async () => {
		let html = await render(strip(""), parseOptionSelections("package-manager:npm"));

		expect(html).not.toContain("data-option-value");
		expect(html.match(/<input[^>]*checked[^>]*>/)).not.toBeNull();
	});
});
