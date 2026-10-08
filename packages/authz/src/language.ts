/**
 * The condition dialect every policy is written in: `@sdxc/expression` made
 * strict, so a missing or mistyped fact fails a rule instead of answering
 * `false`, with shared conditions referenced as `condition`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExpressionError } from "@sdxc/expression";
import type { Result } from "@sdxc/result";

import { createLanguage } from "@sdxc/expression";

/** Builds the dialect; called once, on the first compile. */
function createAuthzLanguage() {
	return createLanguage({ strict: true, reference: "condition" });
}

/** The dialect policies compile under. */
export type AuthzLanguage = ReturnType<typeof createAuthzLanguage>;

/** A condition in its stored JSON form, as `when` and `conditions` take it. */
export type Condition = AuthzLanguage["Expression"];

/** A condition once compiled. */
export type CompiledCondition = AuthzLanguage["Compiled"];

/** Holds the dialect once built, so importing the package builds nothing. */
const CACHE: { language?: AuthzLanguage } = {};

/** The dialect, built on first use. */
export function language(): AuthzLanguage {
	CACHE.language ??= createAuthzLanguage();
	return CACHE.language;
}

/**
 * Reads a condition from the text form into the JSON form a policy stores, for
 * people authoring rules in a form or a config file.
 *
 * @param text Like `ctx.article.authorId == ctx.actor.id`.
 * @returns The JSON form, or the parse failure with its `line` and `column`.
 * @example parseCondition(`exists(ctx.actor) and ctx.article.authorId == ctx.actor.id`)
 */
export function parseCondition(text: string): Result<Condition, ExpressionError> {
	return language().parse(text);
}
