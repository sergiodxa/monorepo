/**
 * Public surface of `@pkg/spec`: the executable specification runtime. The
 * primary consumer is the `spec` CLI; the exports exist so programmatic
 * embedders (test harnesses, tooling) can load and run suites directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type * from "./ast";
export type { Sink, SuiteResult, TestResult, TestStatus } from "./diagnostics";
export {
	ExpectationError,
	LoadError,
	ParseError,
	PermissionDeniedError,
	ResolutionError,
	SpecError,
	ToolError,
	WorkspaceEscapeError,
} from "./errors";
export type { DiagnosticCode } from "./errors";
export { executeTest } from "./executor";
export type { ExecutionContext } from "./executor";
export { lex } from "./lexer";
export { loadSuite } from "./loader";
export type { LoadedSuite } from "./loader";
export { parse } from "./parser";
export { createPermissionSet, parseGrants } from "./permissions";
export type { Grant, Grants, PermissionKind, PermissionSet } from "./permissions";
export type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "./plugin";
export { createBrowserPlugin } from "./plugins/browser";
export { createCliPlugin } from "./plugins/cli";
export { createFsPlugin } from "./plugins/fs";
export { createHttpPlugin } from "./plugins/http";
export { createRegistry } from "./registry";
export type { Registry, ResolvedCallable } from "./registry";
export { reportFatal, reportSuite } from "./reporter";
export { runSuite } from "./runner";
export type { RunOptions } from "./runner";
export { positionAt } from "./source";
export type { Position, SourceFile, Span } from "./source";
export type { Token, TokenKind } from "./tokens";
export { KEYWORDS } from "./tokens";
export { connectStdioPlugin, servePlugin } from "./transport-stdio";
export { formatValue, valueEquals } from "./values";
export type { ToolArg, Value, ValueObject } from "./values";
export { createWorkspace } from "./workspace";
export type { Workspace } from "./workspace";
