/**
 * Tests for the run-monitor button's transition rule — the single decision that separates
 * a run worth telling the visitor about from one that isn't. Exercised as a pure function
 * over a real i18next instance rather than through the DOM, since the surrounding flow is
 * a `fetch` and a poll loop and the rule is the part that can quietly go wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@pkg/i18n";
import { describe, expect, test } from "vitest";

import { transitionToast } from "./run-monitor-button";

let { i18n } = await createTranslator({
	resources: {
		en: {
			translation: {
				page: {
					monitor: {
						run: {
							toast: {
								up: "{{name}} is up",
								down: "{{name}} is down",
								degraded: "{{name}} is degraded",
								changed: "The check you just ran changed this monitor's status.",
							},
						},
					},
				},
			},
		},
	},
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

describe("transitionToast", () => {
	test("announces a recovery in the monitor's own name", () => {
		let toast = transitionToast(i18n.t, "Homepage", "down", "up");

		expect(toast).toEqual({
			title: "Homepage is up",
			description: "The check you just ran changed this monitor's status.",
			color: "success",
		});
	});

	test("tones an outage as danger and a slowdown as a warning", () => {
		expect(transitionToast(i18n.t, "Homepage", "up", "down")?.color).toBe("danger");
		expect(transitionToast(i18n.t, "Homepage", "up", "degraded")?.color).toBe("warning");
	});

	/** A monitor's first ever result has nothing before it, which is still a change worth saying. */
	test("announces the first result of a monitor that had never been checked", () => {
		expect(transitionToast(i18n.t, "Homepage", null, "up")?.title).toBe("Homepage is up");
	});

	/**
	 * The rule the whole feature hangs on: running a check that finds everything exactly as
	 * it was must stay silent, or every manual run would toast and the toast would stop
	 * meaning anything.
	 */
	test("says nothing when the run left the status where it was", () => {
		expect(transitionToast(i18n.t, "Homepage", "up", "up")).toBeUndefined();
		expect(transitionToast(i18n.t, "Homepage", "down", "down")).toBeUndefined();
		expect(transitionToast(i18n.t, "Homepage", "degraded", "degraded")).toBeUndefined();
	});

	/** An unreadable outcome is not a transition — there is nothing truthful to announce. */
	test("says nothing when the new status is unknown", () => {
		expect(transitionToast(i18n.t, "Homepage", "up", null)).toBeUndefined();
	});
});
