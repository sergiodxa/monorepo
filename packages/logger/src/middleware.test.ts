/**
 * Unit tests for the request-logging middleware: verifies it attaches a `Logger`
 * to the context before the downstream handler runs, flushes exactly once on the
 * success path, and on the error path logs an `unhandled_error` event (deriving
 * the message from both `Error` and non-`Error` throws) before re-throwing and
 * still flushing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RequestContext } from "remix/router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import logger from "./middleware.js";
import { Logger } from "./request-logger.js";

describe("logger middleware", () => {
	let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	function createContext(url = "https://example.com/test") {
		return new RequestContext(new Request(url));
	}

	test("attaches a Logger to the context before calling next", async () => {
		let ctx = createContext();
		let seen: Logger | undefined;

		await logger(ctx, async () => {
			seen = ctx.logger;
			return new Response("ok");
		});

		expect(seen).toBeInstanceOf(Logger);
	});

	test("returns the downstream response unchanged and flushes once on success", async () => {
		let ctx = createContext();

		let response = await logger(ctx, async () => new Response("ok", { status: 201 }));

		expect(response.status).toBe(201);
		expect(await response.text()).toBe("ok");
		expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
		expect(consoleErrorSpy).not.toHaveBeenCalled();
	});

	test("logs unhandled_error with the error message and stack, then re-throws", async () => {
		let ctx = createContext();
		let error = new Error("boom");

		await expect(
			logger(ctx, async () => {
				throw error;
			}),
		).rejects.toBe(error);

		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
		expect(consoleInfoSpy).not.toHaveBeenCalled();

		let [, output] = consoleErrorSpy.mock.calls[0] as [
			string,
			{ events?: Array<Record<string, unknown>> },
		];
		expect(output.events?.[0]?.event).toBe("unhandled_error");
		expect(output.events?.[0]?.error).toBe("boom");
		expect(typeof output.events?.[0]?.stack).toBe("string");
	});

	test("stringifies a non-Error throw instead of reading .message/.stack, and still flushes", async () => {
		let ctx = createContext();

		await expect(
			logger(ctx, async () => {
				throw "not an error object";
			}),
		).rejects.toBe("not an error object");

		expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

		let [, output] = consoleErrorSpy.mock.calls[0] as [
			string,
			{ events?: Array<Record<string, unknown>> },
		];
		expect(output.events?.[0]?.error).toBe("not an error object");
		expect(output.events?.[0]?.stack).toBeUndefined();
	});
});
