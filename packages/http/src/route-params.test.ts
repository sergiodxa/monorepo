/**
 * Tests for `requireParams`: typed non-null access to matched route params, throwing
 * `MissingRouteParamError` when a required param is absent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { MissingRouteParamError, requireParams } from "./route-params";

describe("requireParams", () => {
	test("returns the requested param as a non-null value, ignoring extras", () => {
		let result = requireParams({ id: "42", extra: "x" }, "id");
		expect(result).toEqual({ id: "42" });
	});

	test("returns multiple params", () => {
		let result = requireParams({ tenantId: "t1", clientId: "c1" }, "tenantId", "clientId");
		expect(result).toEqual({ tenantId: "t1", clientId: "c1" });
	});

	test("throws MissingRouteParamError when a required param is absent", () => {
		expect(() => requireParams({}, "id")).toThrow(MissingRouteParamError);
		expect(() => requireParams({ other: "x" }, "id")).toThrow("Missing required route param: id");
	});

	test("the error exposes the missing param name", () => {
		let error: unknown;
		try {
			requireParams({}, "tenantId");
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(MissingRouteParamError);
		expect((error as MissingRouteParamError).param).toBe("tenantId");
	});
});
