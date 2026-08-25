/**
 * Unit tests for the `update-language` form validator: accepts any supported
 * language code plus the special `"auto"` value, which transforms to `null` so the
 * middleware falls back to the `Accept-Language` header.
 *
 * Exercises the schema directly via `remix/data-schema`'s `parseSafe()` with real
 * `FormData`, since this `f.object(...)` form-data schema requires a raw `FormData`
 * or `URLSearchParams` instance for its field-level rules to run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { UpdateLanguageSchema } from "~/app/http/validators/language";

describe("UpdateLanguageSchema", () => {
	test.each(["en", "es", "de", "ja", "fr", "it"])("accepts the supported language '%s'", (lang) => {
		let formData = new FormData();
		formData.set("language", lang);
		let result = s.parseSafe(UpdateLanguageSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.language).toBe(lang);
		}
	});

	test("transforms 'auto' into null", () => {
		let formData = new FormData();
		formData.set("language", "auto");
		let result = s.parseSafe(UpdateLanguageSchema, formData);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.language).toBeNull();
		}
	});

	test("rejects an unsupported language code", () => {
		let formData = new FormData();
		formData.set("language", "klingon");
		expect(s.parseSafe(UpdateLanguageSchema, formData).success).toBe(false);
	});

	test("rejects a missing language field", () => {
		expect(s.parseSafe(UpdateLanguageSchema, new FormData()).success).toBe(false);
	});
});
