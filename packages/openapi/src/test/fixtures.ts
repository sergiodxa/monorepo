/**
 * A small API the tests share: a route map, a problem catalog, named schemas and the
 * operations describing them, so each test file exercises one declaration end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as coerce from "@sdxc/json-schema/coerce";
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";
import { del, get, patch, post, route } from "remix/routes";

import { createDocument } from "../document.js";
import { defineOperation } from "../operation.js";
import { bearer } from "../security.js";

/** The routes the operations document. */
export const ROUTES = route("/api/v1", {
	monitors: {
		index: get("/monitors"),
		create: post("/monitors"),
		show: get("/monitors/:monitorId"),
		update: patch("/monitors/:monitorId"),
		destroy: del("/monitors/:monitorId"),
	},
});

/** The problem types the API answers with. */
export const PROBLEMS = defineProblems("https://docs.example.com/errors/", {
	badRequest: { slug: "bad-request", status: 400, title: "The request is malformed" },
	validationError: {
		slug: "validation-error",
		status: 400,
		title: "The request failed validation",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
	unauthorized: { slug: "unauthorized", status: 401, title: "Authentication is required" },
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
});

/** A monitor as the API returns it. */
export const MONITOR = s
	.object({
		id: s.string().pipe(checks.pattern(/^mon_\d+$/)),
		name: s.string(),
		intervalSeconds: s.integer(),
		enabledAt: s.nullable(s.integer()),
	})
	.meta({ id: "Monitor" });

/** Lists monitors, paginated through the query string. */
export const MONITORS_INDEX = defineOperation("monitorsIndex", ROUTES.monitors.index, {
	summary: "List monitors",
	tags: ["Monitors"],
	query: s.object({
		limit: s.optional(coerce.number().pipe(checks.min(1), checks.max(100))),
		cursor: s.optional(s.string()),
	}),
	responses: {
		200: {
			description: "A page of monitors",
			body: s.object({ data: s.array(MONITOR) }),
			headers: { Link: { schema: s.string(), required: false } },
		},
	},
	problems: ["unauthorized"],
	security: [{ apiKey: ["monitors:read"] }],
});

/** Creates a monitor. */
export const MONITOR_CREATE = defineOperation("monitorCreate", ROUTES.monitors.create, {
	summary: "Create a monitor",
	body: s.object({
		name: s.string().pipe(checks.minLength(1)),
		intervalSeconds: s.defaulted(s.integer().pipe(checks.min(60)), 300),
	}),
	responses: { 201: { description: "The created monitor", body: s.object({ data: MONITOR }) } },
	problems: ["badRequest", "validationError", "unauthorized"],
	security: [{ apiKey: ["monitors:write"] }],
});

/** Shows one monitor. */
export const MONITOR_SHOW = defineOperation("monitorShow", ROUTES.monitors.show, {
	summary: "Show a monitor",
	params: s.object({ monitorId: s.string().pipe(checks.pattern(/^mon_\d+$/)) }),
	responses: { 200: { description: "The monitor", body: s.object({ data: MONITOR }) } },
	problems: ["notFound", "unauthorized"],
});

/** Deletes one monitor, with no params schema, so its variable documents as a string. */
export const MONITOR_DESTROY = defineOperation("monitorDestroy", ROUTES.monitors.destroy, {
	summary: "Delete a monitor",
	responses: { 204: { description: "Deleted" } },
	problems: ["notFound"],
	security: [],
});

/**
 * The document over the fixture operations, with an API-key scheme required by default.
 *
 * @returns A fresh builder, so a test can add operations without affecting another.
 */
export function createFixtureDocument() {
	return createDocument({
		info: { title: "Monitors API", version: "1" },
		servers: [{ url: "https://api.example.com" }],
		securitySchemes: { apiKey: bearer({ description: "An API key" }) },
		security: [{ apiKey: [] }],
		problems: PROBLEMS,
	}).add(MONITORS_INDEX, MONITOR_CREATE, MONITOR_SHOW, MONITOR_DESTROY);
}
