/**
 * Tests for the immediate logger's console output formatting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Logger } from "./logger.js";

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

	describe("info", () => {
		test("calls console.info with correct structure", () => {
			let logger = new Logger();
			logger.info("test_event");

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("includes payload in output", () => {
			let logger = new Logger();
			logger.info("user_subscribed", { email: "test@example.com", source: "homepage" });

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				email: "test@example.com",
				source: "homepage",
				event: "user_subscribed",
				timestamp: 1738590000000,
			});
		});
	});

	describe("error", () => {
		test("calls console.error with correct structure", () => {
			let logger = new Logger();
			logger.error("test_error");

			expect(consoleErrorSpy).toHaveBeenCalledWith({
				event: "test_error",
				timestamp: 1738590000000,
			});
		});

		test("includes payload in output", () => {
			let logger = new Logger();
			logger.error("api_failure", { service: "buttondown", status: 500 });

			expect(consoleErrorSpy).toHaveBeenCalledWith({
				service: "buttondown",
				status: 500,
				event: "api_failure",
				timestamp: 1738590000000,
			});
		});
	});

	describe("payload handling", () => {
		test("payload properties do not override event or timestamp", () => {
			let logger = new Logger();
			logger.info("test_event", {
				event: "custom_event",
				timestamp: 0,
			});

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("handles undefined payload", () => {
			let logger = new Logger();
			logger.info("test_event", undefined);

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("handles empty payload", () => {
			let logger = new Logger();
			logger.info("test_event", {});

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});
	});
});
