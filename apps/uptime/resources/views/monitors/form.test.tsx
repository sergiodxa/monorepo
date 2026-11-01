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
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import type { SelectMonitor } from "~/database/schema";

import en from "~/resources/locales/en";

import MonitorFormFields from "./form";

let { intl } = createTranslator({
	resources: { en },
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
		ssl_expiry_source: "transparency",
		ssl_transparency_status: null,
		ssl_transparency_checked_at: null,
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
			intl={intl}
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

	test("draws a failed submission's values over the saved ones", async () => {
		let saved = monitor();
		let values = { name: "Typed", url: "not-a-url", expected_status: "404", location_hint: "apac" };
		let basics = await renderToString(
			<MonitorFormFields
				monitor={saved}
				intl={intl}
				page="editMonitor"
				group="basics"
				values={values}
			/>,
		);
		let checks = await renderToString(
			<MonitorFormFields
				monitor={saved}
				intl={intl}
				page="editMonitor"
				group="checks"
				values={values}
			/>,
		);

		expect(basics).toContain('value="Typed"');
		expect(basics).toContain('value="not-a-url"');
		expect(basics).not.toContain('value="Acme"');
		expect(selectedValues(checks, "expected_status")).toEqual(["404"]);
		expect(selectedValues(checks, "location_hint")).toEqual(["apac"]);
	});

	test("marks each field a failed submission named, with its message, and only those", async () => {
		let basics = await renderToString(
			<MonitorFormFields
				intl={intl}
				page="createMonitor"
				group="basics"
				values={{ name: "Homepage", url: "nope" }}
				errors={{ url: "Enter a full URL." }}
			/>,
		);

		expect(basics).toContain("Enter a full URL.");
		expect(basics.match(/<input[^>]*aria-invalid="true"/g)).toHaveLength(1);
		expect(basics).toMatch(
			/<input[^>]*name="url"[^>]*aria-invalid="true"|<input[^>]*aria-invalid="true"[^>]*name="url"/,
		);
	});
});
