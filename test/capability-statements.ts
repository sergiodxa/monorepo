/**
 * Scanner behind the capability-guard rule: reports every place a capability helper
 * — `scope`, `authenticated`, `mfa` — is called as a statement whose value goes
 * nowhere, which reads like a guard while authorizing nothing. Parses each module so
 * a match is the syntax itself, not text that resembles it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import ts from "typescript";

/**
 * The helpers that answer every request with a boolean and never throw, so the
 * caller's own branch is the only thing that can stop a request. `currentSession`
 * and `anonymous` throw the redirect themselves, which makes a statement of one of
 * them the guard, and they stay out of this list.
 */
const GUARDED = ["scope", "authenticated", "mfa"];

/** One dropped capability answer, kept with the line it came from for the failure message. */
export interface CapabilityViolation {
	file: string;
	line: number;
	source: string;
	name: string;
}

/**
 * Why a dropped answer is a bypass and what to write instead, quoted verbatim in the
 * failure so whoever reads it has the reason and the fix together.
 */
export const CAPABILITY_BYPASS_REASON = [
	"A capability helper answers with a boolean and never throws, so a call standing alone",
	"as a statement authorizes nothing: the answer is dropped and the route runs on as though",
	'the check had passed. Branch on the answer — `if (!scope("monitors:write")) throw',
	'redirect(href("/forbidden"));` in a route, `scope("monitors:write") ? <DeleteForm /> : null`',
	"in a view. A statement of `currentSession()` or `anonymous()` is the guard already: those",
	"throw the redirect themselves.",
].join(" ");

/**
 * The dialect a module parses as: `<T>` opens a tag in TSX and a type argument in TS,
 * so a generic arrow function reads correctly only under the extension's own kind.
 */
function scriptKind(file: string): ts.ScriptKind {
	return file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/**
 * The call whose value a statement evaluates and drops, seen through the wrappers that
 * pass a value along untouched, and `null` where the statement's value flows somewhere.
 */
function droppedCall(expression: ts.Expression): ts.CallExpression | null {
	let current = expression;

	while (
		ts.isParenthesizedExpression(current) ||
		ts.isAsExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isNonNullExpression(current)
	) {
		current = current.expression;
	}

	return ts.isCallExpression(current) ? current : null;
}

/**
 * The guarded helper a dropped call names, and `null` for every other callee. Only a
 * plain identifier counts: an app receives these helpers from `createAuthorization`
 * and re-exports them as free functions, while `x.scope(...)` belongs to something
 * else entirely — the service container's request scope, for one.
 */
function guardedCallee(call: ts.CallExpression): string | null {
	let callee = call.expression;
	if (!ts.isIdentifier(callee)) return null;
	return GUARDED.includes(callee.text) ? callee.text : null;
}

/**
 * Scans one module's text for capability answers dropped by an expression statement.
 * Both the file name and its text are taken from the caller so a fixture may be
 * scanned as any path, and the returned `file` is the one that was passed in.
 *
 * @param file - The path reported with each violation, whose extension picks the dialect.
 * @param source - The module's text.
 */
export function findBareCapabilityStatements(file: string, source: string): CapabilityViolation[] {
	let tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, scriptKind(file));
	let lines = source.split("\n");
	let violations: CapabilityViolation[] = [];

	/**
	 * Walks every node, since a statement that drops an answer sits at any depth — a
	 * route handler inside a controller object inside an exported call.
	 */
	function visit(node: ts.Node): void {
		if (ts.isExpressionStatement(node)) {
			let call = droppedCall(node.expression);
			let name = call === null ? null : guardedCallee(call);

			if (name !== null) {
				let line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
				violations.push({ file, line, name, source: (lines[line - 1] ?? "").trim() });
			}
		}

		ts.forEachChild(node, visit);
	}

	ts.forEachChild(tree, visit);

	return violations;
}
