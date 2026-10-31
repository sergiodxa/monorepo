/**
 * Lays the capability scenes out in a real browser inside a three-up card grid: every
 * colour token a scene reads resolves, so no track or pill silently paints transparent,
 * and the card titles under a row of scenes share one baseline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { Feature } from "@sdxc/ui";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import {
	BrowserScene,
	DnsScene,
	FlowScene,
	IntegrationsScene,
	McpScene,
	SslScene,
} from "~/resources/components/marketing/capability-scenes";
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

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Mounts the six scenes as two rows of linked cards, as the home's feature grid draws them. */
function mountGrid() {
	let { t } = translate("en");
	let scenes = [
		["SSL", <SslScene t={t} />],
		["DNS", <DnsScene t={t} />],
		["Integrations", <IntegrationsScene t={t} />],
		["Flows", <FlowScene t={t} />],
		["Browser", <BrowserScene />],
		["MCP", <McpScene />],
	] as const;
	mounted = render(
		<main>
			<style>{"*{animation:none!important;transition:none!important}"}</style>
			<Feature.Grid columns={3}>
				{scenes.map(([title, scene]) => (
					<Feature key={title} href="#">
						<Feature.Media>{scene}</Feature.Media>
						<Feature.Title>{title}</Feature.Title>
						<Feature.Description>{title}</Feature.Description>
					</Feature>
				))}
			</Feature.Grid>
		</main>,
	);
	return mounted;
}

/** Every style rule in the document and its adopted sheets, where `css()` mixins land. */
function styleRules(): CSSStyleRule[] {
	let rules: CSSStyleRule[] = [];
	let walk = (list: CSSRuleList) => {
		for (let rule of list) {
			if (rule instanceof CSSStyleRule) rules.push(rule);
			if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
		}
	};
	for (let sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) walk(sheet.cssRules);
	return rules;
}

/** Custom properties a matching rule reads with no fallback that resolve to nothing on `element`. */
function unresolvedTokens(element: Element, rules: CSSStyleRule[]): string[] {
	let missing: string[] = [];
	let computed = getComputedStyle(element);
	for (let rule of rules) {
		let matches = false;
		try {
			matches = element.matches(rule.selectorText);
		} catch {
			matches = false;
		}
		if (!matches) continue;
		for (let index = 0; index < rule.style.length; index++) {
			let value = rule.style.getPropertyValue(rule.style[index]!);
			for (let match of value.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
				if (computed.getPropertyValue(match[1]!).trim() === "") missing.push(match[1]!);
			}
		}
	}
	return missing;
}

describe("capability scenes", () => {
	test("reads only colour tokens the theme defines", async () => {
		await page.viewport(1280, 900);
		let { container } = mountGrid();
		let rules = styleRules();
		let missing = new Set<string>();
		for (let element of container.querySelectorAll('[data-slot="feature-media"] *')) {
			for (let token of unresolvedTokens(element, rules)) missing.add(token);
		}

		expect([...missing]).toEqual([]);
	});

	test("keeps the titles under each row of scenes on one line", async () => {
		await page.viewport(1280, 900);
		let { container } = mountGrid();
		let tops = [...container.querySelectorAll('[data-slot="feature-title"]')].map((title) =>
			Math.round(title.getBoundingClientRect().top),
		);

		expect(tops).toHaveLength(6);
		expect(new Set(tops.slice(0, 3)).size).toBe(1);
		expect(new Set(tops.slice(3)).size).toBe(1);
	});

	test("keeps every scene inside its card at tablet width", async () => {
		await page.viewport(768, 1024);
		let { container } = mountGrid();
		for (let media of container.querySelectorAll('[data-slot="feature-media"]')) {
			let card = media.closest('[data-slot="feature"]')!.getBoundingClientRect();
			let box = media.getBoundingClientRect();

			expect(box.width).toBeGreaterThan(0);
			expect(box.right).toBeLessThanOrEqual(card.right + 1);
		}
	});
});
