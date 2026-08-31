/**
 * Specs for the mapping between a completed login and the engine's user fields, which
 * is where the subject stays the identity anchor and every display claim the provider
 * omits normalizes to what the user record's columns hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RelyingParty } from "@pkg/auth/relying-party";

import { describe, expect, test } from "vitest";

import { toAuthProfile } from "./oidc";

/** A login whose provider sent nothing beyond the subject, before any override. */
function profile(claims: Partial<RelyingParty.Profile> = {}): RelyingParty.Profile {
	return {
		name: null,
		email: null,
		emailVerified: false,
		username: null,
		picture: null,
		...claims,
	};
}

describe("toAuthProfile", () => {
	test("maps every display claim the provider sent", () => {
		expect(
			toAuthProfile(
				profile({
					email: "person@example.com",
					username: "person",
					name: "A Person",
					picture: "https://cdn.example.com/a.png",
				}),
				"subject-1",
			),
		).toEqual({
			subjectId: "subject-1",
			email: "person@example.com",
			username: "person",
			displayName: "A Person",
			avatar: "https://cdn.example.com/a.png",
		});
	});

	test("keys the record on the subject rather than the email", () => {
		let mapped = toAuthProfile(profile({ email: "person@example.com" }), "subject-1");
		expect(mapped.subjectId).toBe("subject-1");
	});

	test("falls back to the email local part for a provider that sends no username", () => {
		expect(toAuthProfile(profile({ email: "person@example.com" }), "subject-1").username).toBe(
			"person",
		);
	});

	test("normalizes the absent display claims to the empty strings the columns hold", () => {
		expect(toAuthProfile(profile(), "subject-1")).toEqual({
			subjectId: "subject-1",
			email: "",
			username: "",
			displayName: "",
			avatar: "",
		});
	});
});
