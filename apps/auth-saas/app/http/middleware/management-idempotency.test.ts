/**
 * Drives the management API's Idempotency-Key handling through the subjects router and a
 * real tenant object: a retry replays the first response, a reused key with another body
 * is refused, and records live in the tenant's own `idempotency_keys` table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { idempotencyKeys } from "@sdxc/idempotency/data-table";
import { describe, expect, test } from "vitest";

import { buildSubjectsHarness } from "~/app/http/controllers/management/subjects/test-harness";

/** A subject-create body claiming one username. */
function createBody(username: string): string {
	return JSON.stringify({ identifiers: [{ kind: "username", value: username }] });
}

describe("Idempotency-Key on the management API", () => {
	test("answers a retry with the first attempt's response and creates one subject", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();
		let send = () =>
			harness.router.fetch(
				harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
					method: "POST",
					headers: { "Idempotency-Key": '"create-jane"' },
					body: createBody("jane"),
				}),
			);

		let first = await send();
		let retry = await send();

		expect(first.status).toBe(201);
		expect(retry.status).toBe(201);
		expect(await retry.json()).toEqual(await first.json());

		let listed = await harness.tenantDO.listSubjects({});
		expect(listed.ok && listed.subjects.length).toBe(1);
		let records = await harness.tenantDb.findMany(idempotencyKeys);
		expect(records.map((record) => record.state)).toEqual(["completed"]);
	});

	test("refuses a reused key carrying a different body with idempotency-key-reused", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();
		let send = (username: string) =>
			harness.router.fetch(
				harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
					method: "POST",
					headers: { "Idempotency-Key": '"create-once"' },
					body: createBody(username),
				}),
			);

		await send("jane");
		let reused = await send("john");

		expect(reused.status).toBe(422);
		let body = (await reused.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/idempotency-key-reused");
		expect(body.instance).toEqual(expect.any(String));
	});

	test("refuses a key that is not a quoted sf-string", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
				method: "POST",
				headers: { "Idempotency-Key": "unquoted key" },
				body: createBody("jane"),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/idempotency-key-invalid");
	});

	test("runs a request with no key every time", async () => {
		let harness = await buildSubjectsHarness();
		let token = await harness.signToken();

		for (let username of ["jane", "john"]) {
			let response = await harness.router.fetch(
				harness.request(`/tenants/${harness.tenantId}/subjects`, token, {
					method: "POST",
					body: createBody(username),
				}),
			);
			expect(response.status).toBe(201);
		}

		expect(await harness.tenantDb.findMany(idempotencyKeys)).toEqual([]);
		let listed = await harness.tenantDO.listSubjects({});
		expect(listed.ok && listed.subjects.length).toBe(2);
	});
});
