/**
 * Tests for the in-memory provider as the scriptable fake it exists to be: its default of
 * accepting any token, queued outcomes, per-token rules, the facts it reports, and the
 * record of calls a test asserts on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { MemoryCaptcha } from "./memory.js";

import { CaptchaError } from "./index.js";

describe("MemoryCaptcha", () => {
	test("submits a neutral field name unless given one", () => {
		expect(new MemoryCaptcha().field).toBe("captcha-response");
		expect(new MemoryCaptcha({ field: "h-captcha-response" }).field).toBe("h-captcha-response");
	});

	test("accepts any token by default, reporting the configured facts", async () => {
		let captcha = new MemoryCaptcha({ verification: { hostname: "example.com", score: 0.9 } });

		let result = await captcha.verify("anything");

		expect(isSuccess(result) && result.data).toEqual({ hostname: "example.com", score: 0.9 });
	});

	test("refuses an empty token as missing", async () => {
		let result = await new MemoryCaptcha().verify("");

		expect(isFailure(result) && result.error.code).toBe("missing-token");
	});

	test("answers queued outcomes in order, then returns to the default", async () => {
		let captcha = new MemoryCaptcha();
		captcha.failNext("unavailable", ["internal-error"]).passNext({ action: "sign-up" });

		let first = await captcha.verify("a");
		let second = await captcha.verify("b");
		let third = await captcha.verify("c");

		expect(isFailure(first) && first.error).toBeInstanceOf(CaptchaError);
		expect(isFailure(first) && first.error.providerCodes).toEqual(["internal-error"]);
		expect(isSuccess(second) && second.data).toEqual({ action: "sign-up" });
		expect(isSuccess(third)).toBe(true);
	});

	test("answers a token with its own rule every time it is verified", async () => {
		let captcha = new MemoryCaptcha();
		captcha.reject("bot", "rejected").accept("human", { score: 1 });

		let bot = await captcha.verify("bot");
		let again = await captcha.verify("bot");
		let human = await captcha.verify("human");

		expect(isFailure(bot) && bot.error.code).toBe("rejected");
		expect(isFailure(again) && again.error.code).toBe("rejected");
		expect(isSuccess(human) && human.data).toEqual({ score: 1 });
	});

	test("answers a queued outcome before a token's rule", async () => {
		let captcha = new MemoryCaptcha();
		captcha.accept("human").failNext("expired");

		let result = await captcha.verify("human");

		expect(isFailure(result) && result.error.code).toBe("expired");
	});

	test("refuses unknown tokens once told to", async () => {
		let captcha = new MemoryCaptcha({ unknownTokens: "reject" });
		captcha.accept("human");

		let unknown = await captcha.verify("other");
		let known = await captcha.verify("human");

		expect(isFailure(unknown) && unknown.error.code).toBe("rejected");
		expect(isSuccess(known)).toBe(true);
	});

	test("records every call with its address", async () => {
		let captcha = new MemoryCaptcha();

		await captcha.verify("a", { remoteIp: "203.0.113.7" });
		await captcha.verify("b");

		expect(captcha.calls).toEqual([{ token: "a", remoteIp: "203.0.113.7" }, { token: "b" }]);
		expect(captcha.last).toEqual({ token: "b" });
	});

	test("forgets calls, queued outcomes and rules on reset", async () => {
		let captcha = new MemoryCaptcha();
		captcha.reject("bot", "rejected").failNext("unavailable");
		await captcha.verify("x");

		captcha.reset();
		let result = await captcha.verify("bot");

		expect(isSuccess(result)).toBe(true);
		expect(captcha.calls).toEqual([{ token: "bot" }]);
	});
});
