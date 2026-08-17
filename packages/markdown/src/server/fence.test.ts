import Prism from "prismjs";
import { describe, expect, test } from "vitest";

import { normalizeLanguage } from "./fence";

describe("normalizeLanguage", () => {
	test("maps typescript aliases", () => {
		expect(normalizeLanguage("ts")).toBe("typescript");
		expect(normalizeLanguage("tsx")).toBe("tsx");
		expect(normalizeLanguage("TS")).toBe("typescript");
	});

	test("maps jsonc onto a grammar that exists", () => {
		let language = normalizeLanguage("jsonc");
		expect(language).toBe("json");
		// The alias is only worth anything if a grammar answers to the name it
		// resolves to: an unregistered language leaves the fence untokenized rather
		// than failing, so the miss is invisible until a code block renders flat.
		expect(Prism.languages[language]).toBeDefined();
	});
});
