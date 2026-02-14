import { describe, expect, test } from "bun:test";

import { normalizeLanguage } from "./fence";

describe("normalizeLanguage", () => {
	test("maps typescript aliases", () => {
		expect(normalizeLanguage("ts")).toBe("typescript");
		expect(normalizeLanguage("tsx")).toBe("typescript");
		expect(normalizeLanguage("TS")).toBe("typescript");
	});

	test("maps javascript aliases", () => {
		expect(normalizeLanguage("js")).toBe("javascript");
		expect(normalizeLanguage("jsx")).toBe("javascript");
	});

	test("maps shell aliases", () => {
		expect(normalizeLanguage("sh")).toBe("bash");
		expect(normalizeLanguage("shell")).toBe("bash");
	});

	test("maps yaml aliases", () => {
		expect(normalizeLanguage("yml")).toBe("yaml");
	});

	test("maps plain text aliases", () => {
		expect(normalizeLanguage("text")).toBe("plain");
		expect(normalizeLanguage("dotenv")).toBe("plain");
		expect(normalizeLanguage("env")).toBe("plain");
	});

	test("returns language as-is when no alias exists", () => {
		expect(normalizeLanguage("python")).toBe("python");
		expect(normalizeLanguage("sql")).toBe("sql");
	});

	test("is case insensitive", () => {
		expect(normalizeLanguage("TypeScript")).toBe("typescript");
		expect(normalizeLanguage("BASH")).toBe("bash");
	});
});
