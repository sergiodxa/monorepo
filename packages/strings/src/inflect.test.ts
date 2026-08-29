/**
 * Tests for the inflection rules, covering the regular English suffixes, the
 * default irregulars and uncountables, the identifier casings used to derive
 * job names, and the guarantee that a custom inflector's vocabulary stays
 * scoped to that inflector alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	camelize,
	createInflector,
	dasherize,
	humanize,
	ordinalize,
	pluralize,
	singularize,
	underscore,
} from "./inflect";

describe("pluralize", () => {
	test("appends s to a regular noun", () => {
		expect(pluralize("monitor")).toBe("monitors");
		expect(pluralize("post")).toBe("posts");
	});

	test("applies the suffix rules", () => {
		expect(pluralize("status")).toBe("statuses");
		expect(pluralize("box")).toBe("boxes");
		expect(pluralize("category")).toBe("categories");
		expect(pluralize("analysis")).toBe("analyses");
		expect(pluralize("quiz")).toBe("quizzes");
		expect(pluralize("matrix")).toBe("matrices");
		expect(pluralize("day")).toBe("days");
	});

	test("knows the default irregulars", () => {
		expect(pluralize("person")).toBe("people");
		expect(pluralize("man")).toBe("men");
		expect(pluralize("child")).toBe("children");
	});

	test("leaves uncountable nouns alone", () => {
		expect(pluralize("series")).toBe("series");
		expect(pluralize("sheep")).toBe("sheep");
		expect(pluralize("information")).toBe("information");
	});

	test("keeps an already plural word plural", () => {
		expect(pluralize("monitors")).toBe("monitors");
		expect(pluralize("people")).toBe("people");
	});

	test("preserves the first letter's case", () => {
		expect(pluralize("Monitor")).toBe("Monitors");
		expect(pluralize("Person")).toBe("People");
	});

	test("returns the singular form when the count is exactly one", () => {
		expect(pluralize("monitor", 1)).toBe("monitor");
		expect(pluralize("monitor", 0)).toBe("monitors");
		expect(pluralize("monitor", 2)).toBe("monitors");
	});

	test("returns an empty string untouched", () => {
		expect(pluralize("")).toBe("");
	});
});

describe("singularize", () => {
	test("strips the plural suffix", () => {
		expect(singularize("monitors")).toBe("monitor");
		expect(singularize("statuses")).toBe("status");
		expect(singularize("categories")).toBe("category");
		expect(singularize("analyses")).toBe("analysis");
		expect(singularize("matrices")).toBe("matrix");
	});

	test("knows the default irregulars", () => {
		expect(singularize("people")).toBe("person");
		expect(singularize("men")).toBe("man");
		expect(singularize("children")).toBe("child");
	});

	test("leaves uncountable nouns alone", () => {
		expect(singularize("series")).toBe("series");
		expect(singularize("fish")).toBe("fish");
	});

	test("round-trips with pluralize", () => {
		for (let word of ["monitor", "status", "category", "person", "child", "analysis"]) {
			expect(singularize(pluralize(word))).toBe(word);
		}
	});
});

describe("createInflector", () => {
	test("adds domain irregulars and uncountables", () => {
		let inflector = createInflector({
			irregular: [["status-page", "status-pages"]],
			uncountable: ["uptime", "downtime"],
		});

		expect(inflector.pluralize("status-page")).toBe("status-pages");
		expect(inflector.singularize("status-pages")).toBe("status-page");
		expect(inflector.pluralize("uptime")).toBe("uptime");
		expect(inflector.singularize("downtime")).toBe("downtime");
	});

	test("keeps the default rules available", () => {
		let inflector = createInflector({ uncountable: ["uptime"] });

		expect(inflector.pluralize("monitor")).toBe("monitors");
		expect(inflector.singularize("people")).toBe("person");
	});

	test("does not mutate shared state", () => {
		createInflector({ uncountable: ["uptime"] });

		expect(pluralize("uptime")).toBe("uptimes");
	});

	test("keeps two inflectors independent", () => {
		let first = createInflector({ uncountable: ["uptime"] });
		let second = createInflector({ irregular: [["uptime", "uptimings"]] });

		expect(first.pluralize("uptime")).toBe("uptime");
		expect(second.pluralize("uptime")).toBe("uptimings");
	});

	test("exposes the identifier casings too", () => {
		let inflector = createInflector();

		expect(inflector.camelize("cron_job")).toBe("cronJob");
		expect(inflector.underscore("cronJob")).toBe("cron_job");
		expect(inflector.dasherize("cron_job")).toBe("cron-job");
		expect(inflector.humanize("cron_job")).toBe("Cron job");
		expect(inflector.ordinalize(3)).toBe("3rd");
	});
});

describe("camelize", () => {
	test("converts an underscored identifier", () => {
		expect(camelize("cron_job_monitor")).toBe("cronJobMonitor");
	});

	test("uppercases the first letter on request", () => {
		expect(camelize("cron_job_monitor", { upperFirst: true })).toBe("CronJobMonitor");
	});

	test("accepts dashes and spaces as separators", () => {
		expect(camelize("cron-job-monitor")).toBe("cronJobMonitor");
		expect(camelize("cron job monitor")).toBe("cronJobMonitor");
	});

	test("lowercases the head of a pascal-cased identifier", () => {
		expect(camelize("CronJobMonitor")).toBe("cronJobMonitor");
	});

	test("returns an empty string untouched", () => {
		expect(camelize("")).toBe("");
	});
});

describe("underscore", () => {
	test("splits camelCase boundaries", () => {
		expect(underscore("cronJobMonitor")).toBe("cron_job_monitor");
		expect(underscore("CronJobMonitor")).toBe("cron_job_monitor");
	});

	test("keeps an acronym together", () => {
		expect(underscore("HTTPRequest")).toBe("http_request");
		expect(underscore("parseJSONPayload")).toBe("parse_json_payload");
	});

	test("folds dashes and spaces into underscores", () => {
		expect(underscore("cron-job-monitor")).toBe("cron_job_monitor");
		expect(underscore("Cron Job Monitor")).toBe("cron_job_monitor");
	});

	test("leaves an already underscored identifier alone", () => {
		expect(underscore("cron_job_monitor")).toBe("cron_job_monitor");
	});
});

describe("dasherize", () => {
	test("replaces underscores with dashes", () => {
		expect(dasherize("cron_job_monitor")).toBe("cron-job-monitor");
	});

	test("derives a job identifier when composed with underscore", () => {
		expect(dasherize(underscore("SendWelcomeEmailJob"))).toBe("send-welcome-email-job");
	});
});

describe("humanize", () => {
	test("produces sentence case", () => {
		expect(humanize("cron_job_monitor")).toBe("Cron job monitor");
	});

	test("drops a trailing id suffix", () => {
		expect(humanize("monitor_id")).toBe("Monitor");
	});

	test("accepts camelCase input", () => {
		expect(humanize("cronJobMonitor")).toBe("Cron job monitor");
	});

	test("can skip the leading capital", () => {
		expect(humanize("cron_job_monitor", { capitalize: false })).toBe("cron job monitor");
	});
});

describe("ordinalize", () => {
	test("uses the ordinal indicator for the units digit", () => {
		expect(ordinalize(1)).toBe("1st");
		expect(ordinalize(2)).toBe("2nd");
		expect(ordinalize(3)).toBe("3rd");
		expect(ordinalize(4)).toBe("4th");
	});

	test("treats the teens as an exception", () => {
		expect(ordinalize(11)).toBe("11th");
		expect(ordinalize(12)).toBe("12th");
		expect(ordinalize(13)).toBe("13th");
		expect(ordinalize(111)).toBe("111th");
	});

	test("keeps the indicator for larger numbers", () => {
		expect(ordinalize(21)).toBe("21st");
		expect(ordinalize(102)).toBe("102nd");
		expect(ordinalize(1003)).toBe("1003rd");
	});

	test("handles zero and negative numbers", () => {
		expect(ordinalize(0)).toBe("0th");
		expect(ordinalize(-1)).toBe("-1st");
	});
});
