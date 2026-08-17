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

// Runs while `globalThis.document` is still undefined — the default Vitest
// environment has no browser globals, so this is the "server" case for free.
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

	// `handle.queueTask` is a no-op in the server renderer, so its callback
	// never runs there — exercising it directly is the only way to unit test
	// the client-only subscription without a DOM-mounting reconciler, which
	// this repo has no test-time setup for.
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

	// Must run before any test below calls `setIntl` — its default stays
	// registered at module scope for the rest of this file's run.
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
