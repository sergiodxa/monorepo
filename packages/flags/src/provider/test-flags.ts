/**
 * The flag set the specification's own suites evaluate against, read from the
 * vendored `test-flags.json` and translated into the shape this provider takes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import type { EvaluationContext } from "../core/context.js";
import type { FlagMetadata } from "../core/metadata.js";
import type { FlagValue } from "../core/value.js";

import type { FlagConfiguration, FlagSet } from "./memory.js";

/** A flag as the vendored file writes it, before targeting becomes a function. */
interface TestFlag {
	variants: Record<string, FlagValue>;
	defaultVariant?: string | null;
	disabled?: boolean;
	contextEvaluator?: string;
	flagMetadata?: FlagMetadata | null;
}

/**
 * The targeting expressions the vendored file uses, hand-written as functions.
 * The file states them in a language-agnostic expression syntax, and keying on
 * the expression means a release that adds one fails here by name rather than
 * silently evaluating a flag as untargeted.
 */
const EVALUATORS: Record<string, (context: EvaluationContext) => string> = {
	"email == 'ballmer@macrosoft.com' ? 'zero' : ''": (context) =>
		context.email === "ballmer@macrosoft.com" ? "zero" : "",
	"!customer && email == 'ballmer@macrosoft.com' && age > 10 ? 'internal' : ''": (context) =>
		!context.customer &&
		context.email === "ballmer@macrosoft.com" &&
		typeof context.age === "number" &&
		context.age > 10
			? "internal"
			: "",
};

/**
 * Reads the specification's test flag set. A flag whose default variant is null
 * or absent keeps that as a variant name nothing answers to, which is how the
 * suites get the error those two flags exist to produce.
 *
 * @example let provider = new InMemoryProvider(testFlags());
 */
export function testFlags(): FlagSet {
	let source = JSON.parse(
		readFileSync(
			new URL(
				"../../../../docs/vendor/openfeature/assets/gherkin/test-flags.json",
				import.meta.url,
			),
			"utf8",
		),
	) as Record<string, TestFlag>;

	let flags: FlagSet = {};

	for (let [key, flag] of Object.entries(source)) {
		let configuration: FlagConfiguration = {
			variants: flag.variants,
			defaultVariant: flag.defaultVariant ?? "",
		};

		if (flag.disabled) configuration.disabled = true;
		if (flag.flagMetadata) configuration.flagMetadata = flag.flagMetadata;

		if (flag.contextEvaluator) {
			let evaluator = EVALUATORS[flag.contextEvaluator];

			if (!evaluator) {
				throw new Error(`No targeting function is written for "${flag.contextEvaluator}".`);
			}

			configuration.contextEvaluator = evaluator;
		}

		flags[key] = configuration;
	}

	return flags;
}
