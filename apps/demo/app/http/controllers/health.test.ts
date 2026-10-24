/**
 * Drives `GET /health` through the real router, over the in-memory database and over one
 * whose queries fail, so the report a monitor reads follows the database it probes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { HEALTH_MEDIA_TYPE } from "@sdxc/health";
import { beforeEach, expect, test, vi } from "vitest";

import { createTestDatabase, fetchApp } from "~/app/test/router";

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

test("passes while the database answers", async () => {
	let response = await fetchApp(db, "/health");

	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toContain(HEALTH_MEDIA_TYPE);
	expect(await response.json()).toMatchObject({
		status: "pass",
		serviceId: "demo",
		checks: { "database:responseTime": [{ status: "pass" }] },
	});
});

test("fails with 503 when the database query fails", async () => {
	vi.spyOn(db, "exec").mockRejectedValue(new Error("D1 is unavailable"));

	let response = await fetchApp(db, "/health");

	expect(response.status).toBe(503);
	expect(await response.json()).toMatchObject({
		status: "fail",
		checks: { "database:responseTime": [{ status: "fail", output: "error" }] },
	});
});
