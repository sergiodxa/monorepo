/**
 * The `logger` check: the app builds its loggers in `app/initializers/`, and the router and job
 * dispatcher attach that one instance to each invocation, so every line carries the request's
 * trace and a handler logs through `ctx.log` or `currentLog()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SourceFinding, SourceRule } from "./source-rule.js";

import { sourceCheck } from "./source-rule.js";
import { isNode, lineAt, parseModule, walk } from "./syntax.js";

/** The folder that owns the app's single instances. */
const INITIALIZERS = "app/initializers/";

/** Every `createLogger()` call in app code outside `app/initializers/`. */
export const LOGGER_RULE: SourceRule = {
	name: "logger",
	tests: false,
	find: findLoggerInstances,
	passed: "Loggers are built in app/initializers",
	noun: ["logger built outside app/initializers", "loggers built outside app/initializers"],
	fix: "Log through ctx.log, or currentLog() from @sdxc/logger, and build the logger in app/initializers/logger.ts",
};

/** Warns on each `createLogger()` call outside `app/initializers/`. */
export const loggerCheck = sourceCheck(LOGGER_RULE);

/** Each `createLogger()` call in `source`, unless `file` is an initializer. */
export function findLoggerInstances(file: string, source: string): SourceFinding[] {
	if (file.startsWith(INITIALIZERS) || file.includes(`/${INITIALIZERS}`)) return [];
	let parsed = parseModule(file, source);
	if (parsed === null) return [];
	let findings: SourceFinding[] = [];
	walk(parsed.program, (node) => {
		if (node.type !== "CallExpression") return;
		let callee = node.callee;
		if (!isNode(callee) || callee.type !== "Identifier" || callee.name !== "createLogger") return;
		findings.push({ line: lineAt(source, node.start), message: "calls createLogger()" });
	});
	return findings;
}
