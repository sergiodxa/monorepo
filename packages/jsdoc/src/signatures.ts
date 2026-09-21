/**
 * Maps a callable declaration onto the documented signature: its generics, its
 * parameters and its return type. Written annotations win, and a `@param {T}`
 * tag fills in for source that leaves the types to JSDoc alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import ts from "typescript";

import type { DocComment, DocParameter, DocSignature, DocTypeParameter } from "./types.js";

import { findTag, findTags } from "./tags.js";

/**
 * Read a callable declaration into its documented signature.
 *
 * @param declaration - Function, method, constructor or accessor declaration.
 * @param comment - The comment above it, whose `@param` tags describe the parameters.
 * @returns The signature, with each parameter matched to the tag that names it.
 */
export function toSignature(
	declaration: ts.SignatureDeclarationBase,
	comment: DocComment | null,
): DocSignature {
	return {
		comment,
		typeParameters: toTypeParameters(declaration.typeParameters, comment),
		parameters: (declaration.parameters ?? [])
			.filter((parameter) => !isThisParameter(parameter))
			.map((parameter) => toParameter(parameter, comment)),
		returns: declaration.type?.getText() ?? findTag(comment, "returns")?.type ?? null,
	};
}

/**
 * Read generic parameters, taking a description from the `@template` tag that
 * names each one and a constraint from its `{…}` annotation when the
 * declaration carries no `extends` clause.
 *
 * @param declarations - Type parameters as written, if any.
 * @param comment - The comment whose `@template` tags describe them.
 * @returns One entry per type parameter, in declaration order.
 */
export function toTypeParameters(
	declarations: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
	comment: DocComment | null,
): DocTypeParameter[] {
	let tags = findTags(comment, "template");

	return (declarations ?? []).map((declaration) => {
		let name = declaration.name.text;
		let tag = tags.find((candidate) => candidate.name === name);
		return {
			name,
			constraint: declaration.constraint?.getText() ?? tag?.type ?? null,
			default: declaration.default?.getText() ?? null,
			description: tag?.text || null,
		};
	});
}

/** Read one parameter, preferring its annotation over the `@param` tag's type. */
function toParameter(
	declaration: ts.ParameterDeclaration,
	comment: DocComment | null,
): DocParameter {
	let name = declaration.name.getText();
	let tag = findTags(comment, "param").find((candidate) => candidate.name === name);

	return {
		name,
		type: declaration.type?.getText() ?? tag?.type ?? null,
		description: tag?.text || null,
		optional: Boolean(declaration.questionToken ?? declaration.initializer),
		rest: Boolean(declaration.dotDotDotToken),
		default: declaration.initializer?.getText() ?? null,
	};
}

/**
 * Recognize the `this` parameter, which types the receiver rather than an
 * argument a caller passes.
 */
function isThisParameter(declaration: ts.ParameterDeclaration): boolean {
	return ts.isIdentifier(declaration.name) && declaration.name.text === "this";
}
