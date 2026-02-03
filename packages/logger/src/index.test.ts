import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";

import { logger } from "./index";

describe("logger", () => {
	let consoleInfoSpy: ReturnType<typeof spyOn>;
	let consoleWarnSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let dateNowSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
		consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		dateNowSpy = spyOn(Date, "now").mockReturnValue(1738590000000);
	});

	afterEach(() => {
		consoleInfoSpy.mockRestore();
		consoleWarnSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		dateNowSpy.mockRestore();
	});

	describe("logger.info", () => {
		test("calls console.info with correct structure", () => {
			logger.info("test_event");

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("includes payload in output", () => {
			logger.info("user_subscribed", { email: "test@example.com", source: "homepage" });

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				email: "test@example.com",
				source: "homepage",
				event: "user_subscribed",
				timestamp: 1738590000000,
			});
		});
	});

	describe("logger.warn", () => {
		test("calls console.warn with correct structure", () => {
			logger.warn("test_warning");

			expect(consoleWarnSpy).toHaveBeenCalledWith({
				event: "test_warning",
				timestamp: 1738590000000,
			});
		});

		test("includes payload in output", () => {
			logger.warn("rate_limit_approaching", { current: 90, limit: 100 });

			expect(consoleWarnSpy).toHaveBeenCalledWith({
				current: 90,
				limit: 100,
				event: "rate_limit_approaching",
				timestamp: 1738590000000,
			});
		});
	});

	describe("logger.error", () => {
		test("calls console.error with correct structure", () => {
			logger.error("test_error");

			expect(consoleErrorSpy).toHaveBeenCalledWith({
				event: "test_error",
				timestamp: 1738590000000,
			});
		});

		test("includes payload in output", () => {
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
			logger.info("test_event", undefined);

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});

		test("handles empty payload", () => {
			logger.info("test_event", {});

			expect(consoleInfoSpy).toHaveBeenCalledWith({
				event: "test_event",
				timestamp: 1738590000000,
			});
		});
	});
});
