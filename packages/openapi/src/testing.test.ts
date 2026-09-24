/**
 * Tests for conformance checking: a conforming exchange passes, each kind of departure
 * is reported, and the recorder collects violations across a router's exchanges and
 * lists the declared statuses no exchange produced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Violation } from "./testing.js";

import { createFixtureDocument, PROBLEMS } from "./test/fixtures.js";
import { checkResponse, createConformanceRecorder } from "./testing.js";

const MONITOR = { id: "mon_1", name: "Home", intervalSeconds: 60, enabledAt: null };

/** The kinds of violation one exchange produces, empty when it conforms. */
async function kindsOf(request: Request, response: Response): Promise<Violation["kind"][]> {
	let result = await checkResponse(createFixtureDocument(), request, response);
	return isFailure(result) ? result.error.violations.map((violation) => violation.kind) : [];
}

/** A GET to the fixture API. */
function getRequest(path: string): Request {
	return new Request(`https://api.example.com${path}`);
}

describe("checkResponse", () => {
	test("a response matching its declared status, media type and body conforms", async () => {
		let response = Response.json({ data: MONITOR });
		expect(await kindsOf(getRequest("/api/v1/monitors/mon_1"), response)).toEqual([]);
	});

	test("a catalog problem the operation lists conforms", async () => {
		expect(await kindsOf(getRequest("/api/v1/monitors/mon_1"), PROBLEMS.notFound())).toEqual([]);
	});

	test("a request matching no operation is undocumented-operation", async () => {
		expect(await kindsOf(getRequest("/api/v1/teams"), Response.json({}))).toEqual([
			"undocumented-operation",
		]);
	});

	test("a status the operation does not document is undocumented-status", async () => {
		let response = new Response(null, { status: 204 });
		expect(await kindsOf(getRequest("/api/v1/monitors/mon_1"), response)).toEqual([
			"undocumented-status",
		]);
	});

	test("a media type the response does not declare is undocumented-media-type", async () => {
		let response = new Response("<p>Home</p>", { headers: { "Content-Type": "text/html" } });
		expect(await kindsOf(getRequest("/api/v1/monitors/mon_1"), response)).toEqual([
			"undocumented-media-type",
		]);
	});

	test("a problem of a type the operation does not list is undocumented-problem-type", async () => {
		let request = new Request("https://api.example.com/api/v1/monitors", { method: "POST" });
		let response = Response.json(
			{ type: "https://docs.example.com/errors/other", status: 400, title: "Other" },
			{ status: 400, headers: { "Content-Type": "application/problem+json" } },
		);
		expect(await kindsOf(request, response)).toEqual(["undocumented-problem-type"]);
	});

	test("a problem whose extensions fail the entry's schema is a body mismatch", async () => {
		let request = new Request("https://api.example.com/api/v1/monitors", { method: "POST" });
		let response = PROBLEMS.validationError({
			extensions: { errors: [{ pointer: "/name", code: "invalid", message: "Required" }] },
		});
		let malformed = new Response(
			JSON.stringify({
				type: "https://docs.example.com/errors/validation-error",
				title: "The request failed validation",
				status: 400,
				errors: "nope",
			}),
			{ status: 400, headers: { "Content-Type": "application/problem+json" } },
		);

		expect(await kindsOf(request, response)).toEqual([]);
		expect(await kindsOf(request, malformed)).toEqual(["body-mismatch"]);
	});

	test("a body that fails its schema is a body mismatch per issue, with a pointer", async () => {
		let response = Response.json({ data: { ...MONITOR, id: "dns_1", intervalSeconds: "60" } });
		let result = await checkResponse(
			createFixtureDocument(),
			getRequest("/api/v1/monitors/mon_1"),
			response,
		);

		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.violations.map((violation) => violation.pointer)).toEqual([
			"/data/id",
			"/data/intervalSeconds",
		]);
		expect(result.error.violations[0]?.operationId).toBe("monitorShow");
	});

	test("a required header the response lacks is missing-header", async () => {
		let document = createFixtureDocument();
		let [index] = document.operations();
		let declared = index?.spec.responses[200];
		if (declared?.headers?.Link === undefined) throw new Error("expected a Link header");
		declared.headers.Link.required = true;

		let result = await checkResponse(
			document,
			getRequest("/api/v1/monitors"),
			Response.json({ data: [] }),
		);
		declared.headers.Link.required = false;

		expect(isFailure(result) && result.error.violations.map((violation) => violation.kind)).toEqual(
			["missing-header"],
		);
	});

	test("the response body stays readable after the check", async () => {
		let response = Response.json({ data: MONITOR });
		await checkResponse(createFixtureDocument(), getRequest("/api/v1/monitors/mon_1"), response);
		expect(await response.json()).toEqual({ data: MONITOR });
	});
});

describe("createConformanceRecorder", () => {
	test("records a router's exchanges, and lists declared statuses no exchange produced", async () => {
		let document = createFixtureDocument();
		let recorder = createConformanceRecorder(document);
		let router = createRouter({ middleware: [recorder.middleware] });
		let [index, create, show, destroy] = document.operations();
		if (!index || !create || !show || !destroy) throw new Error("expected four operations");

		router.map(index.route, () => Response.json({ data: [MONITOR] }));
		router.map(show.route, () => Response.json({ data: { name: "Home" } }));
		router.map(destroy.route, () => PROBLEMS.notFound());
		router.map(create.route, () => Response.json({ data: MONITOR }, { status: 201 }));

		await router.fetch("https://api.example.com/api/v1/monitors");
		await router.fetch("https://api.example.com/api/v1/monitors/mon_1");
		await router.fetch("https://api.example.com/api/v1/monitors/mon_1", { method: "DELETE" });

		expect(recorder.violations().map((violation) => [violation.kind, violation.pointer])).toEqual([
			["body-mismatch", "/data/id"],
			["body-mismatch", "/data/intervalSeconds"],
			["body-mismatch", "/data/enabledAt"],
		]);
		expect(recorder.uncovered()).toEqual([
			{ operationId: "monitorsIndex", status: 401 },
			{ operationId: "monitorCreate", status: 201 },
			{ operationId: "monitorCreate", status: 400 },
			{ operationId: "monitorCreate", status: 401 },
			{ operationId: "monitorShow", status: 404 },
			{ operationId: "monitorShow", status: 401 },
			{ operationId: "monitorDestroy", status: 204 },
		]);
	});
});
