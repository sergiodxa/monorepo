/**
 * Tests the credential reader, which is what lets a provider be constructed at
 * module scope against a secret store: a resolver is awaited once however many
 * calls need it, and a failed read is not what an instance is left with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { secretReader, verificationSecret } from "./secret.js";

describe("secretReader", () => {
	test("answers a credential given directly", async () => {
		expect(await secretReader("whsec_direct")()).toBe("whsec_direct");
	});

	test("calls a resolver once however many reads follow", async () => {
		let reads = 0;
		let read = secretReader(async () => {
			reads += 1;

			return await Promise.resolve("whsec_resolved");
		});

		expect(await read()).toBe("whsec_resolved");
		expect(await read()).toBe("whsec_resolved");
		expect(reads).toBe(1);
	});

	test("calls a resolver once for reads awaiting it together", async () => {
		let reads = 0;
		let read = secretReader(async () => {
			reads += 1;

			return await Promise.resolve("whsec_resolved");
		});

		expect(await Promise.all([read(), read(), read()])).toEqual([
			"whsec_resolved",
			"whsec_resolved",
			"whsec_resolved",
		]);
		expect(reads).toBe(1);
	});

	test("asks again after a read that failed", async () => {
		let attempts = 0;
		let read = secretReader(async () => {
			attempts += 1;
			if (attempts === 1) throw new Error("secret store unavailable");

			return await Promise.resolve("whsec_resolved");
		});

		await expect(read()).rejects.toThrow("secret store unavailable");

		expect(await read()).toBe("whsec_resolved");
		expect(await read()).toBe("whsec_resolved");
		expect(attempts).toBe(2);
	});

	test("reports a resolver throwing before it awaits as a rejection", async () => {
		let read = secretReader(() => {
			throw new Error("secret store unavailable");
		});

		await expect(read()).rejects.toThrow("secret store unavailable");
	});
});

describe("verificationSecret", () => {
	test("answers the secret a reader resolves", async () => {
		expect(await verificationSecret(secretReader(() => "whsec_resolved"))).toBe("whsec_resolved");
	});

	test("answers empty for a secret that could not be read", async () => {
		let read = secretReader(
			async () => await Promise.reject(new Error("secret store unavailable")),
		);

		expect(await verificationSecret(read)).toBe("");
	});
});
