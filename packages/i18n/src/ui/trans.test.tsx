/**
 * Tests `Trans`: folding MessageFormat 2 markup into `components` elements (nested, standalone,
 * and unmatched names), raw interpolation left to the renderer's escaping, and the fallback to
 * an ancestor `IntlProvider`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { createI18n } from "../lib/i18n.js";

import { IntlProvider } from "./intl-provider.js";
import { Trans } from "./trans.js";

/** English messages exercising each kind of markup. */
const MESSAGES = {
	greeting: "Hello {#b}{$name}{/b}, welcome back",
	nested: "Read {#link}the {#em}new{/em} post{/link} now",
	lineBreak: "One{#br/}Two",
	link: "See {#link}docs{/link}",
	plain: "Hi there",
	count:
		".input {$count :number}\n.match $count\none {{{#b}{$count}{/b} post}}\n* {{{#b}{$count}{/b} posts}}",
};

/** Builds an English translator over {@link MESSAGES}, collecting reported errors. */
function make(errors: string[] = []) {
	return createI18n({
		locale: "en",
		fallbackLanguage: "en",
		resources: { en: MESSAGES },
		onError: (error, key) => errors.push(`${key}: ${error.message}`),
	});
}

describe(Trans, () => {
	test("interpolates values and wraps markup in the matching component", async () => {
		let html = await renderToString(
			<Trans intl={make()} i18nKey="greeting" values={{ name: "Bob" }} components={{ b: <b /> }} />,
		);

		expect(html).toBe("Hello <b>Bob</b>, welcome back");
	});

	test("nests markup inside markup", async () => {
		let html = await renderToString(
			<Trans
				intl={make()}
				i18nKey="nested"
				components={{ link: <u class="post" />, em: <em /> }}
			/>,
		);

		expect(html).toBe('Read <u class="post">the <em>new</em> post</u> now');
	});

	test("renders standalone markup as the component with no children", async () => {
		let html = await renderToString(
			<Trans intl={make()} i18nKey="lineBreak" components={{ br: <br /> }} />,
		);

		expect(html).toBe("One<br />Two");
	});

	test("wraps any name, including ones HTML treats as void", async () => {
		let html = await renderToString(
			<Trans intl={make()} i18nKey="link" components={{ link: <u class="docs" /> }} />,
		);

		expect(html).toBe('See <u class="docs">docs</u>');
	});

	test("renders markup inside plural variants", async () => {
		let html = await renderToString(
			<Trans intl={make()} i18nKey="count" values={{ count: 3 }} components={{ b: <b /> }} />,
		);

		expect(html).toBe("<b>3</b> posts");
	});

	test("renders an unmatched name's children unwrapped and reports it", async () => {
		let errors: string[] = [];
		let html = await renderToString(<Trans intl={make(errors)} i18nKey="link" />);

		expect(html).toBe("See docs");
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain("link");
	});

	test("leaves escaping of raw values to the renderer", async () => {
		let html = await renderToString(
			<Trans
				intl={make()}
				i18nKey="greeting"
				values={{ name: "<i>A&B</i>" }}
				components={{ b: <b /> }}
			/>,
		);

		expect(html).toBe("Hello <b>&lt;i&gt;A&amp;B&lt;/i&gt;</b>, welcome back");
	});

	test("renders a plain message with no components", async () => {
		expect(await renderToString(<Trans intl={make()} i18nKey="plain" />)).toBe("Hi there");
	});

	test("falls back to the nearest ancestor IntlProvider's translator", async () => {
		let html = await renderToString(
			<IntlProvider intl={make()}>
				<Trans i18nKey="plain" />
			</IntlProvider>,
		);

		expect(html).toBe("Hi there");
	});
});
