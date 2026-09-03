/**
 * Tests for the batched logger's accumulation and flush behavior.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Logger } from "./batched-logger.js";

describe(Logger.name, () => {
	let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let dateNowSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1738590000000);
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		dateNowSpy.mockRestore();
	});

	describe("constructor", () => {
		test("accepts a string identifier", () => {
			let batchedLogger = new Logger("workflow:ping:abc123");

			batchedLogger.info("test_event");
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith("workflow:ping:abc123", expect.any(Object));
		});
	});

	describe("fromRequest", () => {
		test("creates logger with request method and URL as identifier", () => {
			let request = new Request("https://example.com/test");
			let batchedLogger = Logger.fromRequest(request);

			batchedLogger.info("test_event");
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"GET https://example.com/test",
				expect.any(Object),
			);
		});

		test("includes correct method for POST requests", () => {
			let postRequest = new Request("https://example.com/api/subscribe", { method: "POST" });
			let batchedLogger = Logger.fromRequest(postRequest);

			batchedLogger.info("subscription_created");
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"POST https://example.com/api/subscribe",
				expect.any(Object),
			);
		});
	});

	describe("accumulation", () => {
		test("does not log immediately when calling info/error", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.info("event1");
			batchedLogger.error("event2");

			expect(consoleInfoSpy).not.toHaveBeenCalled();
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});
	});

	describe("flush", () => {
		test("outputs all events in a single console call with identifier", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.info("event1", { key: "value1" });
			batchedLogger.info("event2", { key: "value2" });
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			expect(consoleInfoSpy).toHaveBeenCalledWith("test-context", {
				timestamp: expect.any(Number),
				events: [
					{ level: "info", event: "event1", key: "value1" },
					{ level: "info", event: "event2", key: "value2" },
				],
			});
		});

		test("uses console.error when any error is present", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.info("info_event");
			batchedLogger.error("error_event");
			batchedLogger.flush();

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleInfoSpy).not.toHaveBeenCalled();
		});

		test("uses console.info when only info events are present", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.info("info_event1");
			batchedLogger.info("info_event2");
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		test("clears events after flushing", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.info("event1");
			batchedLogger.flush();
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
		});

		test("does nothing when no events are accumulated", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.flush();

			expect(consoleInfoSpy).not.toHaveBeenCalled();
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		test("includes level in each event output", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.info("info_event");
			batchedLogger.error("error_event");
			batchedLogger.flush();

			expect(consoleErrorSpy).toHaveBeenCalledWith("test-context", {
				timestamp: expect.any(Number),
				events: [
					{ level: "info", event: "info_event" },
					{ level: "error", event: "error_event" },
				],
			});
		});

		test("includes payload in event output", () => {
			let batchedLogger = new Logger("test-context");

			batchedLogger.info("user_subscribed", { email: "test@example.com", source: "homepage" });
			batchedLogger.flush();

			expect(consoleInfoSpy).toHaveBeenCalledWith("test-context", {
				timestamp: expect.any(Number),
				events: [
					{
						level: "info",
						event: "user_subscribed",
						email: "test@example.com",
						source: "homepage",
					},
				],
			});
		});
	});
});
