/**
 * Tests for `IntlProvider`, `setIntl`, and `intl`. The default Vitest environment has no
 * browser globals, so the server-render path runs as is and `document` is stubbed where the
 * browser-only default is exercised.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { renderToString } from "remix/ui/server";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createI18n } from "../lib/i18n.js";

import { intl, IntlProvider, setIntl } from "./intl-provider.js";

/** Builds a translator over a single bundle. */
function make(locale: string, messages: Record<string, string> = {}) {
	return createI18n({ locale, fallbackLanguage: locale, resources: { [locale]: messages } });
}

function Greeting(handle: Handle) {
	return () => <span>{intl(handle).t("greeting")}</span>;
}

describe(setIntl, () => {
	test("throws when called outside of a browser", () => {
		expect(() => setIntl(make("en"))).toThrow();
	});
});

describe(IntlProvider, () => {
	test("publishes the translator so descendants can translate through it", async () => {
		let html = await renderToString(
			<IntlProvider intl={make("en", { greeting: "Hello" })}>
				<Greeting />
			</IntlProvider>,
		);

		expect(html).toContain("Hello");
	});

	test("renders no host element of its own around children", async () => {
		let html = await renderToString(
			<IntlProvider intl={make("en")}>
				<span>child</span>
			</IntlProvider>,
		);

		expect(html).toBe("<span>child</span>");
	});
});

describe(intl, () => {
	beforeAll(() => {
		(globalThis as { document?: unknown }).document = {};
	});

	afterAll(() => {
		delete (globalThis as { document?: unknown }).document;
	});

	test("throws when there is no ancestor IntlProvider and no default registered", () => {
		let handle = { context: { get: () => undefined } } as unknown as Handle<unknown, any>;

		expect(() => intl(handle)).toThrow();
	});

	test("falls back to the setIntl default when there is no ancestor IntlProvider", () => {
		let fallback = make("en");
		setIntl(fallback);

		let handle = { context: { get: () => undefined } } as unknown as Handle<unknown, any>;

		expect(intl(handle)).toBe(fallback);
	});

	test("prefers an ancestor IntlProvider over the setIntl default", () => {
		setIntl(make("en"));
		let scoped = make("es");

		let handle = { context: { get: () => scoped } } as unknown as Handle<unknown, any>;

		expect(intl(handle)).toBe(scoped);
	});
});
