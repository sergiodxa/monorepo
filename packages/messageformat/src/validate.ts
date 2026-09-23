/**
 * Data model validation: the checks the MessageFormat 2 specification requires before a
 * well-formed message may be formatted, applied alike to parsed source and to data model
 * objects handed to the constructor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Declaration, Expression, MessageData, Options } from "./data-model.js";

import { MessageError } from "./errors.js";

/**
 * Checks declarations for duplicates (a variable used before its `.local` or `.input` counts
 * as declared), then a select message's variants: key count, duplicate key lists, a
 * catch-all variant, and an annotation behind every selector.
 */
export function validate(message: MessageData): Result<MessageData, MessageError> {
	let declarationError = checkDeclarations(message.declarations);
	if (declarationError) return failure(declarationError);
	if (message.type === "message") return success(message);

	let count = message.selectors.length;
	let seen = new Set<string>();
	let hasFallback = false;
	for (let variant of message.variants) {
		if (variant.keys.length !== count) {
			return failure(
				new MessageError(
					"variant-key-mismatch",
					`Variant has ${variant.keys.length} keys for ${count} selectors`,
				),
			);
		}
		let id = JSON.stringify(
			variant.keys.map((key) => (key.type === "*" ? null : key.value.normalize("NFC"))),
		);
		if (seen.has(id)) {
			return failure(new MessageError("duplicate-variant", "Two variants have the same keys"));
		}
		seen.add(id);
		if (variant.keys.every((key) => key.type === "*")) hasFallback = true;
	}
	if (!hasFallback) {
		return failure(new MessageError("missing-fallback-variant", "No variant has only `*` keys"));
	}
	for (let selector of message.selectors) {
		if (!isAnnotated(message.declarations, selector.name)) {
			return failure(
				new MessageError(
					"missing-selector-annotation",
					`Selector \`$${selector.name}\` has no function annotation`,
					{ source: `$${selector.name}` },
				),
			);
		}
	}
	return success(message);
}

/**
 * Finds the first redeclared variable. Every variable an expression references becomes
 * implicitly declared, so a later declaration of it, or a `.local` referencing itself, fails.
 */
function checkDeclarations(declarations: Declaration[]) {
	let declared = new Set<string>();
	for (let declaration of declarations) {
		let references = new Set<string>();
		collectReferences(declaration.value, references);
		if (declaration.type === "input") references.delete(declaration.name);
		else if (references.has(declaration.name)) return duplicate(declaration.name);
		if (declared.has(declaration.name)) return duplicate(declaration.name);
		for (let name of references) declared.add(name);
		declared.add(declaration.name);
	}
}

/** Builds the error for a redeclared variable. */
function duplicate(name: string) {
	return new MessageError("duplicate-declaration", `Variable \`$${name}\` is declared twice`, {
		source: `$${name}`,
	});
}

/** Adds the names of the variables an expression's operand and options reference. */
function collectReferences(expression: Expression, into: Set<string>) {
	if (expression.arg?.type === "variable") into.add(expression.arg.name);
	for (let value of Object.values(expression.function?.options ?? ({} as Options))) {
		if (value.type === "variable") into.add(value.name);
	}
}

/**
 * True when the variable's declaration has a function, directly or through a chain of
 * `.local` declarations that each reference the previous variable.
 */
function isAnnotated(declarations: Declaration[], name: string): boolean {
	let declaration = declarations.find((candidate) => candidate.name === name);
	if (!declaration) return false;
	if (declaration.value.function) return true;
	let arg = declaration.value.arg;
	if (declaration.type === "input" || arg?.type !== "variable") return false;
	return isAnnotated(declarations, arg.name);
}
