/**
 * Lays the docs shell out in a real browser: the docked sidebar scrolls on its own, and
 * the search box at its top keeps the whole of its focus ring inside that scroll box,
 * lined up with the column it sits in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { DocSection } from "~/app/services/docs";

import DocsLayout, { buildDocsLabels } from "~/resources/layouts/docs";
import { buildMarketingChrome } from "~/resources/layouts/marketing";
import en from "~/resources/locales/en";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** English copy, built here because the app's translator also wires the server logger. */
const translate = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
});

/** How far the field's keyboard focus ring reaches past its border: 3px wide, 2px out. */
const RING_REACH = 5;

/** One section of two guides, enough to draw the sidebar. */
const SECTIONS: DocSection[] = [
	{
		title: "Getting Started",
		order: 1,
		docs: ["Introduction", "Quick Start Guide"].map((title, order) => ({
			path: `/docs/${order}`,
			frontmatter: {
				title,
				description: title,
				section: { title: "Getting Started", order: 1 },
				order,
				lastUpdated: undefined,
			},
		})),
	},
];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

describe("DocsLayout", () => {
	test("keeps the search box's focus ring inside the docked sidebar", async () => {
		await page.viewport(1280, 900);
		let { t } = translate("en");
		mounted = render(
			<DocsLayout
				isSignedIn={false}
				chrome={buildMarketingChrome(t)}
				sections={SECTIONS}
				activePath="/docs/0"
				labels={buildDocsLabels(t)}
			>
				<p>Page</p>
			</DocsLayout>,
		);

		let sidebar = mounted.$('[data-slot="docs-sidebar"]') as HTMLElement;
		let input = sidebar.querySelector("input")!;
		let box = sidebar.getBoundingClientRect();
		let field = input.getBoundingClientRect();
		let content = sidebar.parentElement!.querySelector('[data-slot="docs-content"]')!;

		expect(getComputedStyle(sidebar).overflowX).not.toBe("visible");
		expect(field.left - RING_REACH).toBeGreaterThanOrEqual(box.left);
		expect(field.right + RING_REACH).toBeLessThanOrEqual(box.right);
		expect(content.getBoundingClientRect().left - field.right).toBe(40);
	});
});
