/**
 * Lays an API endpoint out in a real browser: prose and code side by side in a wide block,
 * the code following the prose in a narrow one, and the code column held in view under
 * the sticky chrome while a long prose column scrolls past.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { apiReferenceComponents } from "~/resources/components/docs-api-reference";
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

/** The sticky chrome's height the docs layout publishes, which the code column clears. */
const SCROLL_MARGIN = 80;

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	window.scrollTo(0, 0);
	await page.viewport(414, 896);
});

/** Mounts one endpoint in a column `width` pixels wide, its prose `proseHeight` tall. */
function mountEndpoint(width: number, proseHeight = 200) {
	let { t } = translate("en");
	let parts = apiReferenceComponents({ t, operations: new Map() });
	let Endpoint = parts.endpoint!;
	let Main = parts["endpoint-main"]!;
	let Code = parts["endpoint-code"]!;
	mounted = render(
		<div style={{ inlineSize: `${width}px`, "--ui-docs-scroll-margin": `${SCROLL_MARGIN}px` }}>
			<Endpoint>
				<Main>
					<h2 id="main">List monitors</h2>
					<div style={{ blockSize: `${proseHeight}px` }} />
				</Main>
				<Code>
					<pre id="code">curl https://uptime.sergiodxa.com/api/v1/monitors</pre>
				</Code>
			</Endpoint>
			<div style={{ blockSize: "2000px" }} />
		</div>,
	);
	return mounted;
}

/** The box of the element `selector` matches, failing the test when nothing does. */
function rectOf(view: RenderResult, selector: string): DOMRect {
	let element = view.$(selector);
	if (!element) throw new Error(`Nothing matches ${selector}`);
	return element.getBoundingClientRect();
}

describe("API endpoint layout", () => {
	test("sets the code beside the prose in a wide block", async () => {
		await page.viewport(1440, 900);
		let view = mountEndpoint(1100);

		let main = rectOf(view, '[data-slot="api-endpoint-main"]');
		let code = rectOf(view, '[data-slot="api-endpoint-code"]');

		expect(code.left).toBeGreaterThanOrEqual(main.right);
		expect(Math.abs(code.top - main.top)).toBeLessThan(2);
	});

	test("puts the code after the prose in a narrow block", async () => {
		await page.viewport(414, 896);
		let view = mountEndpoint(380);

		let main = rectOf(view, '[data-slot="api-endpoint-main"]');
		let code = rectOf(view, '[data-slot="api-endpoint-code"]');

		expect(code.top).toBeGreaterThanOrEqual(main.bottom);
		expect(code.width).toBeLessThanOrEqual(380);
	});

	test("keeps the code in view under the sticky chrome while long prose scrolls", async () => {
		await page.viewport(1440, 900);
		let view = mountEndpoint(1100, 3000);
		window.scrollTo(0, 1200);
		await new Promise(requestAnimationFrame);

		let code = rectOf(view, '[data-slot="api-endpoint-code"]');

		expect(code.top).toBeGreaterThanOrEqual(SCROLL_MARGIN - 1);
		expect(code.top).toBeLessThan(SCROLL_MARGIN + 2);
	});
});
