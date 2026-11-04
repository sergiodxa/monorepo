/**
 * Guards the explorer face map: every published slug has a kind, and every kind has a
 * scene entry so a new export cannot fall through to a blank card unnoticed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { FACE_KIND, faceKindFor } from "~/resources/components/ui-faces/kinds";

/** Catalogue slugs the explorer indexes — kept in sync with the face map. */
const CATALOGUE_SLUGS = Object.keys(FACE_KIND);

describe("faceKindFor", () => {
	test("names a kind for every catalogue slug", () => {
		expect(CATALOGUE_SLUGS.length).toBeGreaterThan(150);
		for (let slug of CATALOGUE_SLUGS) {
			expect(faceKindFor(slug)).toBe(FACE_KIND[slug as keyof typeof FACE_KIND]);
		}
	});

	test("falls back to card for an unknown slug", () => {
		expect(faceKindFor("not-a-component")).toBe("card");
	});

	test("keeps lookalike slugs on distinct kinds", () => {
		expect(faceKindFor("alert")).toBe("alert");
		expect(faceKindFor("calendar")).toBe("calendar");
		expect(faceKindFor("range-calendar")).toBe("range-calendar");
		expect(faceKindFor("app-shell")).toBe("app-shell");
		expect(faceKindFor("app-shell-toggle")).toBe("app-shell-toggle");
		expect(faceKindFor("bento")).toBe("bento");
		expect(faceKindFor("landing-hero")).toBe("landing-hero");
	});
});
