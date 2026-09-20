/**
 * Exercises the pieces `flags.ts` adds on top of the entitlement provider:
 * `parseInternalTenantIds`'s defensive JSON parsing, `internalSegmentCondition`
 * turning a tenant list into the condition the "internal" segment resolves to,
 * `InternalSegmentFlagStore` merging that segment into whatever the wrapped
 * store answers, the two logging handlers, and — end to end — the module-scope
 * `flags` instance itself. `cloudflare:workers` is mocked with an in-memory
 * `FLAGS` namespace and an `INTERNAL_TENANT_IDS` secret before the module
 * under test is imported, because that module captures `env` at load time,
 * the way `hostname-cache.test.ts` mocks `HOSTNAMES_KV` for the same reason.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv, createKVNamespace } from "@sdxc/cloudflare-mocks";
import { evaluate, parseFlagSet } from "@sdxc/flags-engine";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { Log } from "@sdxc/logger";
import { success } from "@sdxc/result";
import { describe, expect, test, vi } from "vitest";

let flagsKv = createKVNamespace();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		FLAGS: flagsKv,
		INTERNAL_TENANT_IDS: JSON.stringify(["ten_internal"]),
	}),
}));

let {
	flags,
	InternalSegmentFlagStore,
	internalSegmentCondition,
	logFlagsError,
	logFlagsStale,
	parseInternalTenantIds,
} = await import("./flags");

describe("parseInternalTenantIds", () => {
	test("parses a JSON array of tenant ids", () => {
		expect(parseInternalTenantIds('["ten_1","ten_2"]')).toEqual(["ten_1", "ten_2"]);
	});

	test("answers [] for an undefined secret", () => {
		expect(parseInternalTenantIds(undefined)).toEqual([]);
	});

	test("answers [] for an empty string", () => {
		expect(parseInternalTenantIds("")).toEqual([]);
	});

	test("answers [] for malformed JSON rather than throwing", () => {
		expect(parseInternalTenantIds("[not valid")).toEqual([]);
	});

	test("answers [] for JSON that is not an array", () => {
		expect(parseInternalTenantIds('{"ten_1":true}')).toEqual([]);
	});

	test("drops a non-string entry rather than passing it through", () => {
		expect(parseInternalTenantIds('["ten_1",42,"ten_2"]')).toEqual(["ten_1", "ten_2"]);
	});
});

describe("internalSegmentCondition", () => {
	test("matches the targeting key against the given tenant ids", () => {
		expect(internalSegmentCondition(["ten_1", "ten_2"])).toEqual({
			op: "in",
			field: "targetingKey",
			values: ["ten_1", "ten_2"],
		});
	});
});

describe("InternalSegmentFlagStore", () => {
	test("adds the internal segment to whatever the wrapped store answers", async () => {
		let wrapped = new InMemoryFlagStore({ flags: {} });
		let store = new InternalSegmentFlagStore(wrapped, internalSegmentCondition(["ten_1"]));

		let read = await store.read();

		expect(read).toEqual(
			success({ flags: {}, segments: { internal: internalSegmentCondition(["ten_1"]) } }),
		);
	});

	test("keeps the wrapped store's own segments beside it", async () => {
		let wrapped = new InMemoryFlagStore({
			flags: {},
			segments: { paying: { op: "always" } },
		});
		let store = new InternalSegmentFlagStore(wrapped, internalSegmentCondition(["ten_1"]));

		let read = await store.read();
		if (read.status !== "success") throw new Error("expected a success");

		expect(read.data.segments).toEqual({
			paying: { op: "always" },
			internal: internalSegmentCondition(["ten_1"]),
		});
	});

	test("resolves a rule targeting the internal segment for a listed tenant only", () => {
		let wrapped = new InMemoryFlagStore({
			flags: {
				"release.example": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					targeting: [{ when: { op: "segment", name: "internal" }, serve: "on" }],
				},
			},
		});
		let store = new InternalSegmentFlagStore(wrapped, internalSegmentCondition(["ten_internal"]));

		let read = store.read();
		if (read instanceof Promise) throw new Error("expected a synchronous read");
		if (read.status !== "success") throw new Error("expected a success");

		let snapshot = parseFlagSet(read.data);

		expect(
			evaluate(snapshot, "release.example", false, { targetingKey: "ten_internal" }).value,
		).toBe(true);
		expect(evaluate(snapshot, "release.example", false, { targetingKey: "ten_other" }).value).toBe(
			false,
		);
	});
});

describe("logFlagsStale", () => {
	test("degrades the invocation's log rather than failing it", async () => {
		let records: Record<string, unknown>[] = [];
		let log = new Log({ kind: "request", sink: (record) => void records.push(record) });

		await log.run(() => logFlagsStale({ providerName: "flags-engine", message: "reload failed" }));

		expect(records[0]).toMatchObject({
			outcome: "degraded",
			notes: expect.arrayContaining([
				expect.objectContaining({ name: "flags.stale", message: "reload failed" }),
			]),
		});
	});
});

describe("logFlagsError", () => {
	test("degrades the invocation's log rather than failing it", async () => {
		let records: Record<string, unknown>[] = [];
		let log = new Log({ kind: "request", sink: (record) => void records.push(record) });

		await log.run(() =>
			logFlagsError({
				providerName: "flags-engine",
				errorCode: "PARSE_ERROR",
				message: "the store answered something that is not JSON",
			}),
		);

		expect(records[0]).toMatchObject({
			outcome: "degraded",
			notes: expect.arrayContaining([
				expect.objectContaining({
					name: "flags.provider_error",
					errorCode: "PARSE_ERROR",
				}),
			]),
		});
	});
});

describe("flags", () => {
	test("resolves a release flag targeting the internal segment for a tenant INTERNAL_TENANT_IDS names", async () => {
		await flagsKv.put(
			"flags",
			JSON.stringify({
				flags: {
					"release.example": {
						variants: { on: true, off: false },
						defaultVariant: "off",
						targeting: [{ when: { op: "segment", name: "internal" }, serve: "on" }],
					},
				},
			}),
		);

		await flags.ready();

		let client = flags.getClient();

		expect(await client.boolean("release.example", false, { targetingKey: "ten_internal" })).toBe(
			true,
		);
		expect(await client.boolean("release.example", false, { targetingKey: "ten_other" })).toBe(
			false,
		);
	});

	test("still answers an entitlement key, falling through nothing about the release namespace", async () => {
		await flags.ready();

		let client = flags.getClient();

		expect(
			await client.boolean("entitlement.custom-domain", false, {
				entitlement: { custom_domain: true },
			}),
		).toBe(true);
	});
});
