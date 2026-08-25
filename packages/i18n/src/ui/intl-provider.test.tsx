/**
 * Tests for `IntlProvider`, `setIntl`, and `intl`. The default Vitest
 * environment has no browser globals, so tests here exercise the
 * server-render path for free and call `handle.queueTask`'s callback and
 * `handle.signal`'s abort listener directly to cover the client-only
 * subscription without a DOM-mounting reconciler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n as I18n } from "i18next";
import type { Handle } from "remix/ui";

import { createInstance } from "i18next";
import { renderToString } from "remix/ui/server";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { intl, IntlProvider, setIntl } from "./intl-provider";

function Greeting(handle: Handle) {
	return () => {
		let i18n = intl(handle);
		return <span>{i18n.t("greeting")}</span>;
	};
}

describe(setIntl, () => {
	test("throws when called outside of a browser", () => {
		expect(() => setIntl(createInstance())).toThrow();
	});
});

describe(IntlProvider, () => {
	test("publishes the i18next instance so descendants can translate through it", async () => {
		let i18n = createInstance();
		await i18n.init({ lng: "en", resources: { en: { translation: { greeting: "Hello" } } } });

		let html = await renderToString(
			<IntlProvider i18n={i18n}>
				<Greeting />
			</IntlProvider>,
		);

		expect(html).toContain("Hello");
	});

	test("renders no host element of its own around children", async () => {
		let i18n = createInstance();
		await i18n.init({ lng: "en", resources: { en: { translation: {} } } });

		let html = await renderToString(
			<IntlProvider i18n={i18n}>
				<span>child</span>
			</IntlProvider>,
		);

		expect(html).toBe("<span>child</span>");
	});

	test("subscribes to languageChanged/loaded via queueTask and calls handle.update()", async () => {
		let i18n = createInstance();
		await i18n.init({ lng: "en", resources: { en: { translation: {} } } });

		let queuedTasks: Array<(signal: AbortSignal) => void> = [];
		let updateCalls = 0;
		let abortController = new AbortController();

		let handle = {
			props: { i18n },
			queueTask: (task: (signal: AbortSignal) => void) => queuedTasks.push(task),
			update: () => {
				updateCalls++;
				return Promise.resolve(abortController.signal);
			},
			signal: abortController.signal,
			context: { set: () => {} },
		} as unknown as Handle<IntlProvider.Props, I18n>;

		IntlProvider(handle);
		expect(queuedTasks).toHaveLength(1);
		queuedTasks[0]?.(new AbortController().signal);

		i18n.emit("languageChanged", "es");
		expect(updateCalls).toBe(1);

		i18n.emit("loaded", { en: { translation: true } });
		expect(updateCalls).toBe(2);
	});

	test("stops listening once handle.signal aborts", async () => {
		let i18n = createInstance();
		await i18n.init({ lng: "en", resources: { en: { translation: {} } } });

		let queuedTasks: Array<(signal: AbortSignal) => void> = [];
		let updateCalls = 0;
		let abortController = new AbortController();

		let handle = {
			props: { i18n },
			queueTask: (task: (signal: AbortSignal) => void) => queuedTasks.push(task),
			update: () => {
				updateCalls++;
				return Promise.resolve(abortController.signal);
			},
			signal: abortController.signal,
			context: { set: () => {} },
		} as unknown as Handle<IntlProvider.Props, I18n>;

		IntlProvider(handle);
		queuedTasks[0]?.(new AbortController().signal);

		abortController.abort();
		i18n.emit("languageChanged", "es");

		expect(updateCalls).toBe(0);
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

	test("falls back to the setIntl default when there is no ancestor IntlProvider", async () => {
		let i18n = createInstance();
		await i18n.init({ lng: "en", resources: { en: { translation: { greeting: "Hi" } } } });
		setIntl(i18n);

		let handle = { context: { get: () => undefined } } as unknown as Handle<unknown, any>;

		expect(intl(handle)).toBe(i18n);
	});

	test("prefers an ancestor IntlProvider over the setIntl default", async () => {
		let fallback = createInstance();
		await fallback.init({ lng: "en", resources: { en: { translation: {} } } });
		setIntl(fallback);

		let scoped = createInstance();
		await scoped.init({ lng: "es", resources: { es: { translation: {} } } });

		let handle = { context: { get: () => scoped } } as unknown as Handle<unknown, any>;

		expect(intl(handle)).toBe(scoped);
	});
});
