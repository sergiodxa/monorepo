/**
 * Structural checks for the shared field-parts shape in
 * {@link "./field-parts"}: every assertion builds a plain object against
 * {@link FieldPartsProps}, or an interface extending it, and checks which
 * keys the result carries, since the shape itself carries no behavior beyond
 * the object literals a consumer builds against it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { FieldPartsProps } from "./field-parts.js";

describe("FieldPartsProps", () => {
	test("every member is optional, so an empty object satisfies it", () => {
		let parts: FieldPartsProps = {};

		expect(Object.keys(parts)).toEqual([]);
	});

	test("carries independent styling for its label, input, description, and error parts", () => {
		let label = {} as unknown as FieldPartsProps["label"];
		let input = {} as unknown as FieldPartsProps["input"];
		let description = {} as unknown as FieldPartsProps["description"];
		let error = {} as unknown as FieldPartsProps["error"];
		let parts: FieldPartsProps = { label, input, description, error };

		expect(parts.label).toBe(label);
		expect(parts.input).toBe(input);
		expect(parts.description).toBe(description);
		expect(parts.error).toBe(error);
	});

	test("a wrapper composing more than four parts extends it instead of repeating its members", () => {
		interface WithPreview extends FieldPartsProps {
			swatch?: FieldPartsProps["input"];
		}

		let swatch = {} as unknown as FieldPartsProps["input"];
		let parts: WithPreview = { label: {} as unknown as FieldPartsProps["label"], swatch };

		expect(Object.keys(parts).sort()).toEqual(["label", "swatch"]);
		expect(parts.swatch).toBe(swatch);
	});
});
