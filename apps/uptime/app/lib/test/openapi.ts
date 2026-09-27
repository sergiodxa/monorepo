/**
 * Test helper checking an API test file's exchanges against the OpenAPI document: every
 * response must be one the document declares, and every status the file's operations
 * declare must be produced by some test, so the document and the handlers cannot drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createConformanceRecorder } from "@sdxc/openapi/testing";
import { afterAll, expect } from "vitest";

import { buildApiDocument } from "~/app/http/openapi/document";

/**
 * Installs a conformance recorder for the calling test file. After its last test, the
 * file fails on any undocumented response, and on any status an operation of `routes`
 * declares that no test produced. Operation ids are route map keys, so the map the
 * controller is built from names the operations the file covers.
 *
 * @param routes - The route map of the controller under test.
 * @returns The middleware to put first on every test router the file builds.
 * @example let conformance = checkConformance(monitorsRoutes); createRouter({ middleware: [conformance, ...] });
 */
export function checkConformance(routes: object): Middleware {
	let recorder = createConformanceRecorder(buildApiDocument());
	let covered = new Set(Object.keys(routes));

	afterAll(() => {
		expect(recorder.violations()).toEqual([]);
		expect(recorder.uncovered().filter((entry) => covered.has(entry.operationId))).toEqual([]);
	});

	return recorder.middleware;
}
