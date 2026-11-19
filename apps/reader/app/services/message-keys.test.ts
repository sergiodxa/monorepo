/**
 * Tests `hasMessage`: a name English holds a message for under the prefix narrows, and a
 * name it does not, or one naming a subtree rather than a message, does not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { hasMessage } from "~/app/services/message-keys";

describe("hasMessage", () => {
	test("answers true for a message under the prefix", () => {
		expect(hasMessage("agent.tokens.refused", "token-limit")).toBe(true);
	});

	test("answers false for a name with no message, or one naming a subtree", () => {
		expect(hasMessage("agent.tokens.refused", "made-up")).toBe(false);
		expect(hasMessage("agent", "tokens")).toBe(false);
		expect(hasMessage("agent.tokens.refused", "constructor")).toBe(false);
	});
});
