/**
 * Tests for fence language normalization, checking that aliases resolve to
 * Prism grammar identifiers that actually exist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import Prism from "prismjs";
import { describe, expect, test } from "vitest";

import { normalizeLanguage } from "./fence";

describe("normalizeLanguage", () => {
	test("maps typescript aliases", () => {
		expect(normalizeLanguage("ts")).toBe("typescript");
		expect(normalizeLanguage("tsx")).toBe("tsx");
		expect(normalizeLanguage("TS")).toBe("typescript");
	});

	/**
	 * A grammar must actually answer to the name an alias resolves to, or the
	 * fence silently renders as flat, unhighlighted text. This assertion
	 * catches that kind of broken mapping before it ships.
	 */
	test("maps jsonc onto a grammar that exists", () => {
		let language = normalizeLanguage("jsonc");
		expect(language).toBe("json");
		expect(Prism.languages[language]).toBeDefined();
	});
});
