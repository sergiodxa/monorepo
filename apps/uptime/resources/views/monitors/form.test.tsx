/**
 * Tests for the shared HTTP monitor form fields, asserted over the server-rendered
 * markup of the "checks" group — the half that carries the two `<select>`s. A `<select>`
 * has no `defaultValue` attribute, and two `<option>`s claiming `selected` at once is
 * just as unreadable, so these assert which option is marked and that exactly one is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@sdxc/i18n";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { SelectMonitor } from "~/database/schema";

import en from "~/app/locales/en";

import MonitorFormFields from "./form";

let { i18n: i18next } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** A saved monitor whose region and expected status are both away from the form's create-time defaults. */
function monitor(overrides: Partial<SelectMonitor> = {}): SelectMonitor {
	return {
		id: "monitor-1",
		created_at: 0,
		updated_at: 0,
		enabled_at: null,
		next_due_at: null,
		team_id: "team-1",
		author_id: "author-1",
		name: "Acme",
		url: "https://acme.test",
		method: "HEAD",
		expected_status: 301,
		interval_seconds: 600,
		degraded_after_ms: 5000,
		timeout_seconds: 10,
		location_hint: "weur",
		ssl_monitoring_enabled: false,
		ssl_expiry_warning_days: 30,
		ssl_expires_at: null,
		ssl_issuer: null,
		ssl_last_checked_at: null,
		ssl_status: "unknown",
		last_status: null,
		last_checked_at: null,
		last_response_time_ms: null,
		...overrides,
	};
}

/** The inner markup of one named `<select>`, so option assertions can't match another field's options. */
function optionsOf(html: string, name: string): string {
	let match = new RegExp(`<select[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(html);
	if (match?.[1] === undefined) throw new Error(`The form rendered no <select name="${name}">`);
	return match[1];
}

/** Every `value` whose `<option>` carries the bare `selected` attribute a browser actually honours. */
function selectedValues(html: string, name: string): string[] {
	return [...optionsOf(html, name).matchAll(/<option\b[^>]*>/g)]
		.map((match) => match[0])
		.filter((tag) => /\sselected(?=[\s/>])/.test(tag))
		.map((tag) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");
}

/** Renders the half of the form that holds the selects. */
function render(saved?: SelectMonitor) {
	return renderToString(
		<MonitorFormFields
			monitor={saved}
			i18next={i18next}
			page={saved ? "editMonitor" : "createMonitor"}
			group="checks"
		/>,
	);
}

describe("MonitorFormFields", () => {
	test("marks the saved region selected, and only it", async () => {
		let html = await render(monitor());

		expect(selectedValues(html, "location_hint")).toEqual(["weur"]);
	});

	test("marks the saved expected status selected, and only it", async () => {
		let html = await render(monitor());

		expect(selectedValues(html, "expected_status")).toEqual(["301"]);
	});

	/**
	 * On create the placeholder is the one option allowed to claim `selected` — it used
	 * to claim it unconditionally, which on an edit render made it a second claimant
	 * alongside the saved region.
	 */
	test("selects only the placeholder when there is nothing saved", async () => {
		let html = await render();

		expect(selectedValues(html, "location_hint")).toEqual([""]);
		expect(selectedValues(html, "expected_status")).toEqual(["200"]);
	});

	/** `defaultValue` reaches the DOM as an inert `defaultvalue` attribute the browser ignores. */
	test("names no value through an attribute a <select> does not have", async () => {
		expect(/<select[^>]*defaultvalue=/i.test(await render(monitor()))).toBe(false);
	});
});
