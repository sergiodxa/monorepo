/**
 * Tests the XHTML entity table's shape: that it stays out of the way of the five
 * entities XML predefines, and that every value is a single decoded character
 * rather than a name or a reference left half-resolved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { HTML_ENTITIES } from "./html-entities.js";

describe("HTML_ENTITIES", () => {
	test("covers the three XHTML entity sets", () => {
		/** 96 from lat1, 28 from special (33 less the five XML predefines), 124 from symbol. */
		expect(Object.keys(HTML_ENTITIES)).toHaveLength(248);
	});

	test("omits the names XML predefines, which resolve before it is read", () => {
		for (let name of ["lt", "gt", "amp", "quot", "apos"]) {
			expect(HTML_ENTITIES).not.toHaveProperty(name);
		}
	});

	test("maps every name to one character", () => {
		for (let [name, value] of Object.entries(HTML_ENTITIES)) {
			expect(Array.from(value), `${name} expands to one code point`).toHaveLength(1);
		}
	});

	test("expands no value to an ampersand, which would re-enter decoding", () => {
		for (let [name, value] of Object.entries(HTML_ENTITIES)) {
			expect(value, `${name} is fully decoded`).not.toBe("&");
		}
	});

	test("names the boundary of each set", () => {
		expect(HTML_ENTITIES["nbsp"]).toBe(" ");
		expect(HTML_ENTITIES["yuml"]).toBe("ÿ");
		expect(HTML_ENTITIES["OElig"]).toBe("Œ");
		expect(HTML_ENTITIES["euro"]).toBe("€");
		expect(HTML_ENTITIES["fnof"]).toBe("ƒ");
		expect(HTML_ENTITIES["diams"]).toBe("♦");
	});
});
