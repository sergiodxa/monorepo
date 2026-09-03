/**
 * Unit tests for `fit()`'s `object-fit` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { fit } from "./fit.js";

describe("fit", () => {
	test("defaults to 'cover'", async () => {
		expect(await declarations(fit())).toEqual(["object-fit: cover"]);
	});

	test("applies an explicit value", async () => {
		expect(await declarations(fit("contain"))).toEqual(["object-fit: contain"]);
	});
});
