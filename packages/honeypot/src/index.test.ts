/**
 * Tests the honeypot token: issued fields round-trip through a form, each refusal carries its
 * code, a rotated secret keeps open forms valid, and the timing limits hold at their edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Base64Url } from "@sdxc/crypto";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { HoneypotError } from "./index.js";

import { Honeypot } from "./index.js";

/** The moment every token here is issued at. */
const ISSUED_AT = new Date("2026-09-28T12:00:00Z");

/** A moment `seconds` after {@link ISSUED_AT}. */
function later(seconds: number): Date {
	return new Date(ISSUED_AT.getTime() + seconds * 1000);
}

/** A form carrying the issued token and, when given, a value in the trap field. */
function formFor(fields: Honeypot.Fields, trapValue?: string): FormData {
	let form = new FormData();
	form.set(fields.tokenField, fields.token);
	if (trapValue !== undefined) form.set(fields.trapField, trapValue);
	form.set("content", "hello");
	return form;
}

/** The error code a failed verification carries. */
function codeOf(result: Awaited<ReturnType<Honeypot["verify"]>>): HoneypotError["code"] | null {
	return isFailure(result) ? result.error.code : null;
}

describe("issue", () => {
	test("names a random trap field under the prefix and the configured token field", async () => {
		let honeypot = new Honeypot({ secret: "s3cret" });
		let first = unwrap(await honeypot.issue());
		let second = unwrap(await honeypot.issue());

		expect(first.tokenField).toBe("hp-token");
		expect(first.trapField).toMatch(/^hp_[a-z]{8}$/);
		expect(second.trapField).not.toBe(first.trapField);
	});

	test("draws every trap name from lowercase letters only", async () => {
		let honeypot = new Honeypot({ secret: "s3cret" });
		let letters = new Set<string>();
		for (let index = 0; index < 200; index++) {
			let { trapField } = unwrap(await honeypot.issue());
			expect(trapField).toMatch(/^hp_[a-z]{8}$/);
			for (let letter of trapField.slice(3)) letters.add(letter);
		}

		expect(letters.size).toBe(26);
	});

	test("reads its field names from its options", async () => {
		let honeypot = new Honeypot({ secret: "s3cret", tokenField: "t", trapPrefix: "x_" });
		let fields = unwrap(await honeypot.issue());
		expect(fields.tokenField).toBe("t");
		expect(fields.trapField).toMatch(/^x_[a-z]{8}$/);
	});

	test("refuses to issue without a secret", async () => {
		let result = await new Honeypot({ secret: [] }).issue();
		expect(isFailure(result) && result.error.code).toBe("misconfigured");
	});
});

describe("verify", () => {
	let honeypot = new Honeypot({ secret: "s3cret" });

	test("accepts an untouched form and reports when it was rendered", async () => {
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		let result = await honeypot.verify(formFor(fields, ""), { now: later(42) });

		expect(isSuccess(result) && result.data).toEqual({ renderedAt: ISSUED_AT, elapsedMs: 42_000 });
	});

	test("accepts a form whose trap field was dropped", async () => {
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		expect(isSuccess(await honeypot.verify(formFor(fields), { now: later(5) }))).toBe(true);
	});

	test("reads URLSearchParams as well as FormData", async () => {
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		let params = new URLSearchParams({ [fields.tokenField]: fields.token, [fields.trapField]: "" });
		expect(isSuccess(await honeypot.verify(params, { now: later(5) }))).toBe(true);
	});

	test("refuses a filled trap", async () => {
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		let result = await honeypot.verify(formFor(fields, "https://seo.example"), { now: later(5) });
		expect(codeOf(result)).toBe("trap-filled");
	});

	test("counts whitespace in the trap as filled", async () => {
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		expect(codeOf(await honeypot.verify(formFor(fields, " "), { now: later(5) }))).toBe(
			"trap-filled",
		);
	});

	test("refuses a missing token", async () => {
		let form = new FormData();
		form.set("content", "hello");
		expect(codeOf(await honeypot.verify(form))).toBe("missing-token");
	});

	test.each([
		["no separator", "abc"],
		["an undecodable payload", "!!!.abc"],
		["an undecodable signature", "e30.!!!"],
		["two separators", "a.b.c"],
	])("refuses a token with %s", async (_name, token) => {
		let form = new FormData();
		form.set("hp-token", token);
		expect(codeOf(await honeypot.verify(form))).toBe("invalid-token");
	});

	test("refuses a token signed with another secret", async () => {
		let fields = unwrap(await new Honeypot({ secret: "other" }).issue({ now: ISSUED_AT }));
		expect(codeOf(await honeypot.verify(formFor(fields, ""), { now: later(5) }))).toBe(
			"invalid-token",
		);
	});

	test("refuses a payload edited after signing", async () => {
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		let [, signature] = fields.token.split(".");
		let forged = Base64Url.encode(JSON.stringify({ v: 1, iat: 0, trap: fields.trapField }));
		let form = formFor({ ...fields, token: `${forged}.${signature}` }, "");
		expect(codeOf(await honeypot.verify(form, { now: later(5) }))).toBe("invalid-token");
	});

	test("refuses a validly signed payload of an unknown version", async () => {
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		let tampered = await signPayload("s3cret", { v: 2, iat: ISSUED_AT.getTime(), trap: "hp_x" });
		let form = formFor({ ...fields, token: tampered }, "");
		expect(codeOf(await honeypot.verify(form, { now: later(5) }))).toBe("invalid-token");
	});
});

describe("secret rotation", () => {
	test("verifies with every secret and signs with the first", async () => {
		let old = new Honeypot({ secret: "old" });
		let rotated = new Honeypot({ secret: ["new", "old"] });

		let openForm = unwrap(await old.issue({ now: ISSUED_AT }));
		expect(isSuccess(await rotated.verify(formFor(openForm, ""), { now: later(5) }))).toBe(true);

		let fresh = unwrap(await rotated.issue({ now: ISSUED_AT }));
		expect(codeOf(await old.verify(formFor(fresh, ""), { now: later(5) }))).toBe("invalid-token");
		expect(
			isSuccess(
				await new Honeypot({ secret: "new" }).verify(formFor(fresh, ""), { now: later(5) }),
			),
		).toBe(true);
	});
});

describe("timing", () => {
	test("accepts any speed by default", async () => {
		let honeypot = new Honeypot({ secret: "s3cret" });
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		expect(isSuccess(await honeypot.verify(formFor(fields, ""), { now: ISSUED_AT }))).toBe(true);
	});

	test("refuses a submission faster than minSeconds", async () => {
		let honeypot = new Honeypot({ secret: "s3cret", minSeconds: 3 });
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		expect(codeOf(await honeypot.verify(formFor(fields, ""), { now: later(2.9) }))).toBe(
			"too-fast",
		);
		expect(isSuccess(await honeypot.verify(formFor(fields, ""), { now: later(3) }))).toBe(true);
	});

	test("tolerates a clock skew but refuses a token issued further in the future", async () => {
		let honeypot = new Honeypot({ secret: "s3cret" });
		let fields = unwrap(await honeypot.issue({ now: ISSUED_AT }));
		expect(isSuccess(await honeypot.verify(formFor(fields, ""), { now: later(-30) }))).toBe(true);
		expect(codeOf(await honeypot.verify(formFor(fields, ""), { now: later(-61) }))).toBe(
			"too-fast",
		);
	});

	test("keeps an old form valid unless maxAge is set", async () => {
		let lenient = new Honeypot({ secret: "s3cret" });
		let strict = new Honeypot({ secret: "s3cret", maxAge: 3600 });
		let fields = unwrap(await lenient.issue({ now: ISSUED_AT }));

		expect(isSuccess(await lenient.verify(formFor(fields, ""), { now: later(86_400 * 7) }))).toBe(
			true,
		);
		expect(isSuccess(await strict.verify(formFor(fields, ""), { now: later(3600) }))).toBe(true);
		expect(codeOf(await strict.verify(formFor(fields, ""), { now: later(3601) }))).toBe("expired");
	});
});

/** A token over `payload` as the package signs one, for payloads `issue` never produces. */
async function signPayload(secret: string, payload: object): Promise<string> {
	let encoded = Base64Url.encode(JSON.stringify(payload));
	let key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	let mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
	return `${encoded}.${Base64Url.encode(new Uint8Array(mac))}`;
}
