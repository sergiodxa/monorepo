/**
 * Tests for the shared DNS monitor form fields, asserted over the server-rendered
 * markup. The bug these cover rendered a perfectly valid page: a `defaultValue` on the
 * `<select>` host is not an HTML attribute, so the browser kept the first option and a
 * daily monitor re-saved itself onto the fastest cadence in the list. The assertions
 * therefore read the `selected` attribute off the individual `<option>`s, and check that
 * exactly one claims it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@pkg/i18n";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { SelectDnsMonitor } from "~/database/schema";

import en from "~/app/locales/en";

import DnsMonitorFormFields from "./form";

let { i18n: i18next } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** A saved monitor whose interval is away from the form's create-time default. */
function monitor(overrides: Partial<SelectDnsMonitor> = {}): SelectDnsMonitor {
	return {
		id: "dns-1",
		created_at: 0,
		updated_at: 0,
		team_id: "team-1",
		name: "Acme MX",
		domain: "acme.test",
		interval_seconds: 900,
		next_due_at: null,
		is_enabled: true,
		last_checked_at: null,
		last_status: null,
		zone_file_imported_at: null,
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

describe("DnsMonitorFormFields", () => {
	test("marks the saved interval selected, and only it", async () => {
		let html = await renderToString(
			<DnsMonitorFormFields monitor={monitor()} i18next={i18next} page="editDnsMonitor" />,
		);

		expect(selectedValues(html, "interval_seconds")).toEqual(["900"]);
	});

	test("falls back to a daily sweep with no monitor to read one from", async () => {
		let html = await renderToString(
			<DnsMonitorFormFields i18next={i18next} page="createDnsMonitor" />,
		);

		expect(selectedValues(html, "interval_seconds")).toEqual(["86400"]);
	});

	/**
	 * A domain monitor sweeps every supported type at every known name, so the 300-second
	 * cadence the other monitor types offer is not a bound this form puts one click away.
	 */
	test("offers no interval below the domain-monitor floor", async () => {
		let html = await renderToString(
			<DnsMonitorFormFields monitor={monitor()} i18next={i18next} page="editDnsMonitor" />,
		);

		let values = [...optionsOf(html, "interval_seconds").matchAll(/\bvalue="(\d+)"/g)].map(
			(match) => Number(match[1]),
		);

		expect(values.length).toBeGreaterThan(0);
		expect(Math.min(...values)).toBe(900);
	});

	/**
	 * The regression guard proper: `defaultValue` reaches the DOM as an inert
	 * `defaultvalue` attribute, so its presence means the saved value is being named
	 * somewhere the browser will ignore.
	 */
	test("names no value through an attribute a <select> does not have", async () => {
		let html = await renderToString(
			<DnsMonitorFormFields monitor={monitor()} i18next={i18next} page="editDnsMonitor" />,
		);

		expect(/<select[^>]*defaultvalue=/i.test(html)).toBe(false);
	});
});
