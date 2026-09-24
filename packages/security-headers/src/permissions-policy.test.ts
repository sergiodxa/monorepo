/**
 * Tests for the Permissions-Policy model: denials, wildcards, `self`/`src` tokens and origin
 * strings written through the RFC 9651 serializer, and read back into the same model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { StructuredFieldStringifyError } from "@sdxc/structured-fields";
import { describe, expect, test } from "vitest";

import { parse, stringify } from "./permissions-policy.js";

describe("stringify", () => {
	test("writes a denied feature as an empty inner list", () => {
		expect(stringify({ camera: [], microphone: [], "browsing-topics": [] })).toEqual({
			status: "success",
			data: "camera=(), microphone=(), browsing-topics=()",
		});
	});

	test("writes the wildcard as a bare token", () => {
		expect(stringify({ fullscreen: "*" })).toEqual({ status: "success", data: "fullscreen=*" });
	});

	test("writes self and src as tokens and origins as strings", () => {
		expect(stringify({ geolocation: ["self", "src", "https://maps.example.com"] })).toEqual({
			status: "success",
			data: 'geolocation=(self src "https://maps.example.com")',
		});
	});

	test("writes an empty policy as the empty string", () => {
		expect(stringify({})).toEqual({ status: "success", data: "" });
	});

	test("fails on a feature name outside the key grammar", () => {
		let result = stringify({ Camera: [] });

		expect(isFailure(result)).toBe(true);
		if (isSuccess(result)) return;
		expect(result.error).toBeInstanceOf(StructuredFieldStringifyError);
	});
});

describe("parse", () => {
	test("round-trips every allowlist shape", () => {
		let policy = {
			camera: [] as [],
			fullscreen: "*" as const,
			geolocation: ["self", "src", "https://maps.example.com"],
		};
		let written = stringify(policy);
		if (isFailure(written)) throw written.error;

		expect(parse(written.data)).toEqual({ status: "success", data: policy });
	});

	test("reads a bare self token as a one-origin allowlist", () => {
		expect(parse('payment=self, usb="https://a.example"')).toEqual({
			status: "success",
			data: { payment: ["self"], usb: ["https://a.example"] },
		});
	});

	test("ignores parameters and members of other types", () => {
		expect(parse("camera=();report-to=main, autoplay=?1, midi=(self 1)")).toEqual({
			status: "success",
			data: { camera: [], midi: ["self"] },
		});
	});

	test("fails on text that is not a structured-field dictionary", () => {
		expect(isFailure(parse("camera=(self"))).toBe(true);
	});
});
