/**
 * The error a provider throws, checked for the code it carries and for behaving
 * like an error while it does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { expect, test } from "vitest";

import { ProviderError } from "./error.js";

test("carries the error code it was constructed with", () => {
	let error = new ProviderError("PROVIDER_FATAL", "The flag service is gone.");

	expect(error.code).toBe("PROVIDER_FATAL");
	expect(error.message).toBe("The flag service is gone.");
	expect(error.name).toBe("ProviderError");
	expect(error).toBeInstanceOf(Error);
});

test("falls back to the code as the message", () => {
	expect(new ProviderError("PARSE_ERROR").message).toBe("PARSE_ERROR");
});

test("keeps the cause it was given", () => {
	let cause = new Error("Connection refused");

	expect(new ProviderError("GENERAL", "Could not reach the service.", { cause }).cause).toBe(cause);
});
