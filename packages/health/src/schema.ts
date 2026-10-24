/**
 * The Health Check Response Format for HTTP APIs as a schema that validates a report and
 * describes it as JSON Schema. It accepts everything the format allows, from any service, and
 * yields the report with every status reduced to `pass`, `warn` or `fail`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

import type { Health } from "./types.js";

/** Every status word the format accepts, and the verdict each one means. */
const STATUS_ALIASES: Record<string, Health.Status> = {
	pass: "pass",
	ok: "pass",
	up: "pass",
	warn: "warn",
	fail: "fail",
	error: "fail",
	down: "fail",
};

/**
 * Matches any status word in any case. JSON Schema patterns carry no flags, so each letter is
 * spelled as a two-case class (`[Pp][Aa][Ss][Ss]`) to keep the document and the check equal.
 */
const STATUS_PATTERN = new RegExp(
	`^(${Object.keys(STATUS_ALIASES)
		.map((word) =>
			word
				.split("")
				.map((letter) => `[${letter.toUpperCase()}${letter}]`)
				.join(""),
		)
		.join("|")})$`,
);

/** A status as sent, normalized to its verdict on the way out. */
const STATUS = s
	.string()
	.pipe(checks.pattern(STATUS_PATTERN))
	.meta({
		description: "pass, warn or fail, in any case; ok and up mean pass, error and down fail",
	})
	.transform(
		(value) => STATUS_ALIASES[value.toLowerCase()] ?? "fail",
		s.enum_(["pass", "warn", "fail"]),
	);

/** Relation names or URIs, each pointing at an absolute URI. */
const LINKS = s.record(s.string(), s.string().pipe(checks.url()));

/** One node of one dependency; every field is optional, and implementation keys are kept. */
const CHECK = s.object(
	{
		componentId: s.optional(s.string()),
		componentType: s.optional(s.string()),
		status: s.optional(STATUS),
		observedValue: s.optional(s.any()),
		observedUnit: s.optional(s.string()),
		time: s.optional(
			s
				.string()
				.refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO 8601 date-time")
				.meta({ format: "date-time" }),
		),
		output: s.optional(s.string()),
		affectedEndpoints: s.optional(s.array(s.string())),
		links: s.optional(LINKS),
	},
	{ unknownKeys: "passthrough" },
);

/**
 * A whole report. `status` is the only field the format requires; `checks` keys are
 * `component:measurement`, so at most one colon, and every key a service adds is kept.
 */
const HEALTH_REPORT: s.Schema<unknown, Health.Report> = s
	.object(
		{
			status: STATUS,
			version: s.optional(s.string()),
			releaseId: s.optional(s.string()),
			serviceId: s.optional(s.string()),
			description: s.optional(s.string()),
			notes: s.optional(s.array(s.string())),
			output: s.optional(s.string()),
			checks: s.optional(
				s.record(s.string().pipe(checks.pattern(/^[^:]*(:[^:]*)?$/)), s.array(CHECK)),
			),
			links: s.optional(LINKS),
		},
		{ unknownKeys: "passthrough" },
	)
	.meta({
		title: "Health Check Response",
		description: "The application/health+json format for reporting a service's health",
	});

export default HEALTH_REPORT;
