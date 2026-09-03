/**
 * Tests for the Secrets Store secret mock: the value is only reachable through an awaited
 * `get()`, a missing or failed secret rejects the way the platform does, and the read
 * count lets a test confirm each read happens lazily, at the point of use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createSecretsStoreSecret } from "./secrets-store.js";

describe("createSecretsStoreSecret", () => {
	test("resolves the value it was created with", async () => {
		let secret = createSecretsStoreSecret({ value: "polar_at_1" });

		expect(await secret.get()).toBe("polar_at_1");
	});

	test("rejects when it was never given a value", async () => {
		let secret = createSecretsStoreSecret({ name: "POLAR_ACCESS_TOKEN" });

		await expect(secret.get()).rejects.toThrow(`Secret "POLAR_ACCESS_TOKEN" not found`);
	});

	test("counts reads, so an eager read can be ruled out", async () => {
		let secret = createSecretsStoreSecret({ value: "token" });

		expect(secret.reads).toBe(0);

		await secret.get();
		await secret.get();

		expect(secret.reads).toBe(2);
	});

	test("switches to a new value", async () => {
		let secret = createSecretsStoreSecret({ value: "first" });

		secret.set("second");

		expect(await secret.get()).toBe("second");
	});

	test("fails with the platform's not-found error by default", async () => {
		let secret = createSecretsStoreSecret({ name: "API_KEY", value: "present" });

		secret.fail();

		await expect(secret.get()).rejects.toThrow(`Secret "API_KEY" not found`);
	});

	test("fails with a caller-supplied reason", async () => {
		let secret = createSecretsStoreSecret({ value: "present" });

		secret.fail(new Error("store unreachable"));

		await expect(secret.get()).rejects.toThrow("store unreachable");
	});

	test("recovers from a failure when a value is set again", async () => {
		let secret = createSecretsStoreSecret({ value: "first" });

		secret.fail();
		secret.set("second");

		expect(await secret.get()).toBe("second");
	});

	test("reset restores the original value and the read count", async () => {
		let secret = createSecretsStoreSecret({ value: "original" });

		secret.set("changed");
		await secret.get();
		secret.reset();

		expect(secret.reads).toBe(0);
		expect(await secret.get()).toBe("original");
	});

	test("reset returns a failed secret to its original value", async () => {
		let secret = createSecretsStoreSecret({ value: "original" });

		secret.fail();
		secret.reset();

		expect(await secret.get()).toBe("original");
	});
});
