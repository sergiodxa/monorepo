/**
 * Tests for the predicates.
 *
 * Each one is asked the same question three ways — about a user agent, about a
 * request context, and about the current request — and has to answer the same
 * thing, plus answer at all when the call stack is outside a request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { asyncContext } from "remix/middleware/async-context";
import { createRouter, RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import type { UserAgent } from "./types.js";

import { isAndroid, isApplePlatform, isDesktop, isMobile, isTablet, isTouch } from "./helpers.js";
import { userAgent } from "./middleware.js";
import { parse } from "./parse.js";

const IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const IPAD =
	"Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1";

const MAC =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";

const PIXEL =
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";

const GALAXY_TAB =
	"Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const WINDOWS =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** A request context reached without the middleware, as a surface in front of it would see. */
function contextFor(header: string): RequestContext {
	return new RequestContext(
		new Request("https://example.com/", { headers: { "User-Agent": header } }),
	);
}

/** Asks a predicate about the current request, with the header a router served. */
async function askCurrent(
	header: string,
	predicate: (source?: UserAgent | RequestContext<any, any>) => boolean,
): Promise<boolean> {
	let answer: boolean | undefined;

	let router = createRouter({ middleware: [asyncContext(), userAgent()] });
	router.get("/", () => {
		answer = predicate();
		return new Response("ok");
	});

	await router.fetch(new Request("https://example.com/", { headers: { "User-Agent": header } }));

	if (answer === undefined) throw new Error("The handler never ran.");

	return answer;
}

describe("the three call shapes", () => {
	test("answers about a user agent handed in", () => {
		expect(isMobile(parse(IPHONE))).toBe(true);
		expect(isMobile(parse(MAC))).toBe(false);
	});

	test("answers about a request context handed in", async () => {
		let router = createRouter({ middleware: [userAgent()] });
		let answers: boolean[] = [];
		router.get("/", (ctx) => {
			answers.push(isMobile(ctx), isApplePlatform(ctx));
			return new Response("ok");
		});

		await router.fetch(new Request("https://example.com/", { headers: { "User-Agent": IPHONE } }));

		expect(answers).toEqual([true, true]);
	});

	test("answers about the current request when nothing is handed in", async () => {
		await expect(askCurrent(IPHONE, isMobile)).resolves.toBe(true);
		await expect(askCurrent(MAC, isMobile)).resolves.toBe(false);
	});

	test("answers about a context the middleware never touched", () => {
		expect(isMobile(contextFor(IPHONE))).toBe(false);
		expect(isDesktop(contextFor(MAC))).toBe(false);
	});

	test("answers outside a request, where there is no current context", () => {
		expect(isMobile()).toBe(false);
		expect(isApplePlatform()).toBe(false);
		expect(isTouch()).toBe(false);
	});
});

describe(isApplePlatform, () => {
	test.each([
		[IPHONE, true],
		[IPAD, true],
		[MAC, true],
		[PIXEL, false],
		[WINDOWS, false],
	])("reads %s as %s", (header, expected) => {
		expect(isApplePlatform(parse(header))).toBe(expected);
	});
});

describe(isAndroid, () => {
	test.each([
		[PIXEL, true],
		[GALAXY_TAB, true],
		[IPHONE, false],
		[WINDOWS, false],
	])("reads %s as %s", (header, expected) => {
		expect(isAndroid(parse(header))).toBe(expected);
	});
});

describe(isMobile, () => {
	test.each([
		[IPHONE, true],
		[PIXEL, true],
		[IPAD, false],
		[MAC, false],
	])("reads %s as %s", (header, expected) => {
		expect(isMobile(parse(header))).toBe(expected);
	});
});

describe(isTablet, () => {
	test.each([
		[IPAD, true],
		[GALAXY_TAB, true],
		[IPHONE, false],
		[WINDOWS, false],
	])("reads %s as %s", (header, expected) => {
		expect(isTablet(parse(header))).toBe(expected);
	});
});

describe(isDesktop, () => {
	test.each([
		[MAC, true],
		[WINDOWS, true],
		[IPHONE, false],
		[IPAD, false],
	])("reads %s as %s", (header, expected) => {
		expect(isDesktop(parse(header))).toBe(expected);
	});
});

describe(isTouch, () => {
	test.each([
		[IPHONE, true],
		[IPAD, true],
		[GALAXY_TAB, true],
		[MAC, false],
		[WINDOWS, false],
	])("reads %s as %s", (header, expected) => {
		expect(isTouch(parse(header))).toBe(expected);
	});
});
