/**
 * Unit tests for `findOverdueReleaseFlags`: a `release.*` definition past its
 * declared `expiresAt` is reported, one not past it or carrying none is not,
 * and a `kill.*` definition never is, whatever its own `metadata` holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagStore } from "@sdxc/flags-engine/store";

import { FlagStoreError } from "@sdxc/flags-engine/store";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { failure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { findOverdueReleaseFlags } from "./expiry-report";

let NOW = Date.parse("2026-09-20T00:00:00Z");

describe("findOverdueReleaseFlags", () => {
	test("reports a release flag whose expiresAt has passed", async () => {
		let store = new InMemoryFlagStore({
			flags: {
				"release.overdue": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					metadata: { owner: "identity", expiresAt: "2026-01-01" },
				},
			},
		});

		let result = await findOverdueReleaseFlags(store, NOW);

		expect(result.status).toBe("success");
		expect(result.status === "success" && result.data).toEqual([
			{ key: "release.overdue", owner: "identity", expiresAt: "2026-01-01" },
		]);
	});

	test("does not report a release flag whose expiresAt is still ahead", async () => {
		let store = new InMemoryFlagStore({
			flags: {
				"release.fresh": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					metadata: { owner: "identity", expiresAt: "2026-12-01" },
				},
			},
		});

		let result = await findOverdueReleaseFlags(store, NOW);

		expect(result.status === "success" && result.data).toEqual([]);
	});

	test("does not report a release flag declaring no expiresAt at all", async () => {
		let store = new InMemoryFlagStore({
			flags: {
				"release.indefinite": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					metadata: { owner: "identity" },
				},
			},
		});

		let result = await findOverdueReleaseFlags(store, NOW);

		expect(result.status === "success" && result.data).toEqual([]);
	});

	test("never reports a kill switch, whatever metadata it carries", async () => {
		let store = new InMemoryFlagStore({
			flags: {
				"kill.example": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					metadata: { owner: "identity", expiresAt: "2026-01-01" },
				},
			},
		});

		let result = await findOverdueReleaseFlags(store, NOW);

		expect(result.status === "success" && result.data).toEqual([]);
	});

	test("propagates the store's own failure rather than reporting an empty list", async () => {
		let error = new FlagStoreError("the namespace refused the read", { code: "unavailable" });
		let store: FlagStore = { read: () => failure(error) };

		let result = await findOverdueReleaseFlags(store, NOW);

		expect(result).toEqual(failure(error));
	});
});
