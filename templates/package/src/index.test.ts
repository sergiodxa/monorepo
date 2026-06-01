import { describe, expect, test } from "bun:test";

import { main } from "./index.js";

describe(main, () => {
	test("returns 'Hello world!'", () => {
		expect(main()).toBe("Hello world!");
	});
});