/**
 * Unit tests for {@link warnIfNoAccessibleName} and
 * {@link warnIfNoAccessibleLabel}: each assertion drives the check against a
 * minimal props/children fixture with `console.warn` spied on, and dev mode
 * toggled through `process.env.DEV` the same way `bun:test` already exercises
 * other dev-only warnings in this package (see `heading-scope.test.ts`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { AccessibleNameProps } from "./warn-if-no-accessible-name";

import { warnIfNoAccessibleLabel, warnIfNoAccessibleName } from "./warn-if-no-accessible-name";

const MESSAGE = "Example: needs an accessible name.";

let originalDev: string | undefined;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	originalDev = process.env.DEV;
	warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	if (originalDev === undefined) delete process.env.DEV;
	else process.env.DEV = originalDev;
});

describe(warnIfNoAccessibleName.name, () => {
	test("logs the message in dev mode when there is no aria-label, no aria-labelledby, and no visible text", () => {
		process.env.DEV = "1";
		let props: AccessibleNameProps = {};

		warnIfNoAccessibleName(props, undefined, MESSAGE);

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toBe(MESSAGE);
	});

	test("stays silent when aria-label is set", () => {
		process.env.DEV = "1";
		let props: AccessibleNameProps = { "aria-label": "Delete" };

		warnIfNoAccessibleName(props, undefined, MESSAGE);

		expect(warnSpy).not.toHaveBeenCalled();
	});

	test("stays silent when aria-labelledby is set", () => {
		process.env.DEV = "1";
		let props: AccessibleNameProps = { "aria-labelledby": "delete-label" };

		warnIfNoAccessibleName(props, undefined, MESSAGE);

		expect(warnSpy).not.toHaveBeenCalled();
	});

	test("stays silent when children resolve to visible text", () => {
		process.env.DEV = "1";
		let props: AccessibleNameProps = {};

		warnIfNoAccessibleName(props, "Save changes", MESSAGE);

		expect(warnSpy).not.toHaveBeenCalled();
	});

	test("stays silent outside dev mode, even with no accessible name at all", () => {
		delete process.env.DEV;
		let props: AccessibleNameProps = {};

		warnIfNoAccessibleName(props, undefined, MESSAGE);

		expect(warnSpy).not.toHaveBeenCalled();
	});
});

describe(warnIfNoAccessibleLabel.name, () => {
	test("logs the message in dev mode when there is no aria-label and no aria-labelledby", () => {
		process.env.DEV = "1";
		let props: AccessibleNameProps = {};

		warnIfNoAccessibleLabel(props, MESSAGE);

		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0]?.[0]).toBe(MESSAGE);
	});

	test("stays silent when aria-label is set", () => {
		process.env.DEV = "1";
		let props: AccessibleNameProps = { "aria-label": "Pagination" };

		warnIfNoAccessibleLabel(props, MESSAGE);

		expect(warnSpy).not.toHaveBeenCalled();
	});

	test("stays silent when aria-labelledby is set", () => {
		process.env.DEV = "1";
		let props: AccessibleNameProps = { "aria-labelledby": "pagination-label" };

		warnIfNoAccessibleLabel(props, MESSAGE);

		expect(warnSpy).not.toHaveBeenCalled();
	});

	test("stays silent outside dev mode, even with no accessible name at all", () => {
		delete process.env.DEV;
		let props: AccessibleNameProps = {};

		warnIfNoAccessibleLabel(props, MESSAGE);

		expect(warnSpy).not.toHaveBeenCalled();
	});
});
