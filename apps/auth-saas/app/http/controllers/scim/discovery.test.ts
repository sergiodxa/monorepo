/**
 * `/scim/v2/ServiceProviderConfig`, `/scim/v2/ResourceTypes` and
 * `/scim/v2/Schemas` answer from the Worker alone: no bearer token, no
 * entitlement, and — asserted here through a spy rather than assumed — no
 * call reaching the tenant object at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { buildScimHarness, buildScimRouter, spyOnStub } from "./test-harness";

describe("SCIM discovery documents", () => {
	test("ServiceProviderConfig answers the capability document with no call to the tenant object", async () => {
		let harness = await buildScimHarness();
		let { calls, stub } = spyOnStub(harness.tenantDO);
		let router = buildScimRouter(stub, harness.limiter);

		let response = await router.fetch(
			harness.request("/scim/v2/ServiceProviderConfig", "irrelevant-token"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/scim+json");
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.bulk).toMatchObject({ supported: false });
		expect(body.etag).toMatchObject({ supported: false });
		expect(body.sort).toMatchObject({ supported: false });
		expect(body.filter).toMatchObject({ supported: true });
		expect(body.patch).toMatchObject({ supported: true });
		expect(calls).toHaveLength(0);
	});

	test("ResourceTypes describes Users and Groups with no call to the tenant object", async () => {
		let harness = await buildScimHarness();
		let { calls, stub } = spyOnStub(harness.tenantDO);
		let router = buildScimRouter(stub, harness.limiter);

		let response = await router.fetch(
			harness.request("/scim/v2/ResourceTypes", "irrelevant-token"),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { Resources: Array<{ id: string }> };
		expect(body.Resources.map((resource) => resource.id).sort()).toEqual(["Group", "User"]);
		expect(calls).toHaveLength(0);
	});

	test("Schemas describes only the attributes this connection maps, with no call to the tenant object", async () => {
		let harness = await buildScimHarness();
		let { calls, stub } = spyOnStub(harness.tenantDO);
		let router = buildScimRouter(stub, harness.limiter);

		let response = await router.fetch(harness.request("/scim/v2/Schemas", "irrelevant-token"));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { Resources: Array<{ id: string }> };
		expect(body.Resources.map((resource) => resource.id)).toEqual([
			"urn:ietf:params:scim:schemas:core:2.0:User",
			"urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
			"urn:ietf:params:scim:schemas:core:2.0:Group",
		]);
		expect(calls).toHaveLength(0);
	});
});
