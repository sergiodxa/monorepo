/**
 * Tests the API document: it builds, it describes every `/api/v1/*` route the app serves,
 * and it matches the committed snapshot, so every contract change arrives as a reviewable
 * diff in the commit that makes it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stringify } from "@sdxc/openapi";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { buildApiDocument } from "~/app/http/openapi/document";
import routes from "~/routes/web";

/** Every route leaf under a route map, depth first. */
function leaves(map: object): { method: string; pattern: string }[] {
	return Object.values(map).flatMap((value: unknown) => {
		if (typeof value !== "object" || value === null) return [];
		if ("method" in value && "pattern" in value) {
			return [{ method: String(value.method), pattern: String(value.pattern) }];
		}
		return leaves(value);
	});
}

describe("buildApiDocument", () => {
	test("builds", () => {
		let document = buildApiDocument().build();
		if (document.status === "failure") expect.unreachable(document.error.message);
	});

	test("describes every API route except the document itself", () => {
		let documented = new Set(
			buildApiDocument()
				.operations()
				.map((operation) => `${String(operation.route.method)} ${String(operation.route.pattern)}`),
		);
		let served = [...leaves(routes.api.v1), ...leaves({ cronJobPing: routes.api.cronJobPing })]
			.filter((route) => route.pattern !== routes.api.v1.openapi.pattern.toString())
			.map((route) => `${route.method} ${route.pattern}`);

		expect(served.filter((route) => !documented.has(route))).toEqual([]);
	});

	test("matches the committed snapshot", async () => {
		let document = unwrap(buildApiDocument().build());
		await expect(unwrap(stringify(document))).toMatchFileSnapshot("./openapi.snapshot.json");
	});
});
