import { describe, expect, test } from "bun:test";

import { normalizeLanguage } from "./fence";

describe("normalizeLanguage", () => {
	test("maps typescript aliases", () => {
		expect(normalizeLanguage("ts")).toBe("typescript");
		expect(normalizeLanguage("tsx")).toBe("tsx");
		expect(normalizeLanguage("TS")).toBe("typescript");
	});
});
