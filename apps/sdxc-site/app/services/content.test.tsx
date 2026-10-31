/**
 * Covers the remembered choice a `code-tabs` strip or an `install-command` line may open
 * on, and what the vocabulary accepts as a strip's name. A strip is authored in markdown,
 * so the reader's cookie has to reach it through the document rather than through props,
 * and these render the document to check that it did.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { renderToStream } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { readContent } from "~/app/services/content";
import { LANDING_COMPONENTS } from "~/resources/components/landing";
import { RememberedTabsScope } from "~/resources/components/markdown-blocks";

/** The cookie a reader who picked `manager` sends. */
function picked(manager: string): string {
	return `ui-code-tabs.package-manager=${manager}`;
}

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
 * @param cookie - The `Cookie` header the reader sent.
 * @returns The rendered HTML.
 */
async function render(source: string, cookie: string | null): Promise<string> {
	let content = readContent(source);
	if (isFailure(content)) throw content.error;

	let node = (
		<RememberedTabsScope cookie={cookie}>
			{toRemix(content.data, { components: LANDING_COMPONENTS })}
		</RememberedTabsScope>
	);

	return await new Response(renderToStream(node)).text();
}

/**
 * The radio standing for one tab, as the document rendered it.
 *
 * @param html - The rendered document.
 * @param value - The tab's value.
 * @returns The `input` element's markup.
 */
function tab(html: string, value: string): string {
	let match = html.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`));
	expect(match).not.toBeNull();
	return match?.[0] ?? "";
}

/** The document's text with its markup dropped, so a painted line reads as one string. */
function textOf(html: string): string {
	return html.replace(/<style[^]*?<\/style>/g, "").replace(/<[^>]+>/g, "");
}

describe("a code-tabs strip naming a remembered choice", () => {
	test("opens on the option the reader picked elsewhere", async () => {
		let html = await render(strip(' name="package-manager"'), picked("npm"));

		expect(tab(html, "npm")).toContain("checked");
		expect(tab(html, "bun")).not.toContain("checked");
	});

	test("syncs through its own cookie", async () => {
		let html = await render(strip(' name="package-manager"'), null);

		expect(html).toContain('data-code-tabs="package-manager"');
	});

	test("opens on its first tab for a reader who has picked nothing", async () => {
		let html = await render(strip(' name="package-manager"'), null);

		expect(tab(html, "npm")).toContain("checked");
	});

	test("is a parse error for a choice this site does not remember", () => {
		expect(isFailure(readContent(strip(' name="editor"')))).toBe(true);
	});
});

describe("a code-tabs strip naming nothing", () => {
	test("opens on the tab the author marked, whatever the reader picked", async () => {
		let html = await render(strip(""), picked("npm"));

		expect(html).toContain('data-code-tabs=""');
		expect(tab(html, "bun")).toContain("checked");
		expect(tab(html, "npm")).not.toContain("checked");
	});
});

describe("an install-command line", () => {
	test("spells the line for the manager the reader picked", async () => {
		let html = await render('<install-command command="npm add @sdxc/result" />', picked("bun"));

		expect(tab(html, "bun")).toContain("checked");
		expect(textOf(html)).toContain("bun add @sdxc/result");
		expect(textOf(html)).toContain("pnpm add @sdxc/result");
	});

	test("prints a global install as written", async () => {
		let html = await render('<install-command command="npm add -g @sdxc/kit" />', picked("bun"));

		expect(textOf(html)).toContain("npm add -g @sdxc/kit");
		expect(html).not.toContain("<input");
	});
});
