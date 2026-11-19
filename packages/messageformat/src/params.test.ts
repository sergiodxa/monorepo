/**
 * Type tests for `MessageParams`: each MessageFormat 2 construct that reads a value, and
 * each that only looks like one, so the values a caller passes match what `MessageFormat`
 * formats without falling back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expectTypeOf, test } from "vitest";

import type { MessageParams } from "./index.js";

/** The values an unannotated or `:string` placeholder formats as text. */
type Plain = string | number | bigint;

/** The values `:number` and `:integer` format. */
type Numeric = number | bigint;

describe("MessageParams", () => {
	test("reads placeholders as text values", () => {
		expectTypeOf<MessageParams<"Hello {$name}, {$other :string}!">>().toEqualTypeOf<{
			name: Plain;
			other: Plain;
		}>();
	});

	test("reads :number and :integer operands as numbers", () => {
		expectTypeOf<
			MessageParams<"{$amount :number minimumFractionDigits=2} total, {$items :integer} items">
		>().toEqualTypeOf<{ amount: Numeric; items: Numeric }>();
	});

	test("takes anything for a custom function's operand and for option values", () => {
		expectTypeOf<
			MessageParams<"{$when :datetime} {$n :number maximumFractionDigits=$digits}">
		>().toEqualTypeOf<{ when: unknown; n: Numeric; digits: unknown }>();
	});

	test("reads .input declarations and their uses together", () => {
		expectTypeOf<
			MessageParams<".input {$count :number}\n{{You have {$count} items}}">
		>().toEqualTypeOf<{ count: Numeric }>();
	});

	test("leaves .local names out and reads what their expressions use", () => {
		expectTypeOf<
			MessageParams<".local $total = {$price :number}\n{{Total: {$total} for {$name}}}">
		>().toEqualTypeOf<{ price: Numeric; name: Plain }>();
	});

	test("reads .match selectors and every variant's placeholders", () => {
		expectTypeOf<
			MessageParams<`.input {$count :number}
.match $count
0   {{No messages for {$user}}}
one {{One message}}
*   {{{$count} messages}}`>
		>().toEqualTypeOf<{ count: Numeric; user: Plain }>();
	});

	test("reads variables in markup options but not markup names", () => {
		expectTypeOf<
			MessageParams<"{#b}{$n :number}{/b} posts, {#link href=$url}read{/link}{#br/}">
		>().toEqualTypeOf<{ n: Numeric; url: unknown }>();
	});

	test("ignores escaped braces and variable-like text in literals", () => {
		expectTypeOf<
			MessageParams<"Costs \\{$price\\} or {|{$fake}| :string} and {$real}">
		>().toEqualTypeOf<{ real: Plain }>();
	});

	test("reads nothing from a message without variables", () => {
		expectTypeOf<MessageParams<"Hello world">>().toEqualTypeOf<{}>();
		expectTypeOf<MessageParams<"{{Hello {|world|}}}">>().toEqualTypeOf<{}>();
	});

	test("reads any values from a widened string", () => {
		expectTypeOf<MessageParams<string>>().toEqualTypeOf<Record<string, unknown>>();
	});

	test("rejects a missing, misnamed or mistyped value", () => {
		type Total = MessageParams<"{$count :number} items">;
		// @ts-expect-error -- `count` is required
		let missing: Total = {};
		// @ts-expect-error -- the message reads `count`, not `amount`
		let misnamed: Total = { amount: 3 };
		// @ts-expect-error -- `:number` formats numbers
		let mistyped: Total = { count: "3" };
		expectTypeOf([missing, misnamed, mistyped]).toBeArray();
	});
});
