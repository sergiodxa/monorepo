/**
 * Behavioural tests for `HostMetadataSchema`, the validator for the metadata that
 * round-trips through the Cloudflare for SaaS API to identify which tenant a custom
 * hostname belongs to. Covers the `region` default, the accepted region set, and
 * the `tenant_id` "platform" literal / arbitrary-string union.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";

import { HostMetadataSchema } from "./host-metadata";

describe("HostMetadataSchema", () => {
	test("defaults region to wnam when omitted", async () => {
		let result = await validate({ tenant_id: "tenant-1" }, HostMetadataSchema);
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.region).toBe("wnam");
			expect(result.data.tenant_id).toBe("tenant-1");
		}
	});

	test("accepts the platform literal as tenant_id", async () => {
		let result = await validate({ tenant_id: "platform", region: "weur" }, HostMetadataSchema);
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.tenant_id).toBe("platform");
			expect(result.data.region).toBe("weur");
		}
	});

	test("accepts an arbitrary tenant id string", async () => {
		let result = await validate({ tenant_id: "01H-some-uuid" }, HostMetadataSchema);
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.tenant_id).toBe("01H-some-uuid");
	});

	describe("region enum", () => {
		for (let region of [
			"wnam",
			"enam",
			"sam",
			"weur",
			"eeur",
			"apac",
			"oc",
			"afr",
			"me",
		] as const) {
			test(`accepts the ${region} region`, async () => {
				let result = await validate({ tenant_id: "tenant-1", region }, HostMetadataSchema);
				expect(isSuccess(result)).toBe(true);
				if (isSuccess(result)) expect(result.data.region).toBe(region);
			});
		}

		test("rejects an unknown region", async () => {
			let result = await validate({ tenant_id: "tenant-1", region: "mars" }, HostMetadataSchema);
			expect(isFailure(result)).toBe(true);
		});
	});

	test("rejects metadata missing tenant_id", async () => {
		let result = await validate({ region: "wnam" }, HostMetadataSchema);
		expect(isFailure(result)).toBe(true);
	});
});
