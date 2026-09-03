/**
 * Public surface of `@sdxc/spec`, the executable specification runtime
 * consumed by the `spec` CLI and available to programmatic embedders. This
 * entry point assumes a Bun or Node process because it reaches the
 * filesystem and spawns processes; a runtime without those imports
 * `@sdxc/spec/workers` for the same language core with a smaller capability set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type * from "./ast.js";
export { BUILTIN_NAMESPACES, createBuiltinPlugins } from "./builtins.js";
export type { BuiltinNamespace } from "./builtins.js";
export type { Sink, SuiteResult, TestResult, TestStatus } from "./diagnostics.js";
export {
	ExpectationError,
	LoadError,
	ParseError,
	PermissionDeniedError,
	ResolutionError,
	SpecError,
	ToolError,
	WorkspaceEscapeError,
} from "./errors.js";
export type { DiagnosticCode } from "./errors.js";
export { executeTest } from "./executor.js";
export type { ExecutionContext } from "./executor.js";
export { lex } from "./lexer.js";
export { loadSuite } from "./loader.js";
export { parse } from "./parser.js";
export { createPermissionSet, parseGrants } from "./permissions.js";
export type { Grant, Grants, PermissionKind, PermissionSet } from "./permissions.js";
export type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "./plugin.js";
export { createBrowserPlugin } from "./plugins/browser.js";
export { createCliPlugin } from "./plugins/cli.js";
export { createDbPlugin } from "./plugins/db.js";
export { createEnvPlugin } from "./plugins/env.js";
export { createFsPlugin } from "./plugins/fs.js";
export { createHttpPlugin } from "./plugins/http.js";
export { createJwtPlugin } from "./plugins/jwt.js";
export { createUrlPlugin } from "./plugins/url.js";
export { createRegistry } from "./registry.js";
export type { Registry, ResolvedCallable } from "./registry.js";
export { reportFatal, reportSuite } from "./reporter.js";
export { runTests } from "./run.js";
export type { RunTestsOptions, WorkspaceFactory } from "./run.js";
export { runSuite } from "./runner.js";
export type { RunOptions } from "./runner.js";
export { positionAt } from "./source.js";
export type { Position, SourceFile, Span } from "./source.js";
export { loadSources } from "./sources.js";
export type { LoadedSuite, SpecSource } from "./sources.js";
export type { Token, TokenKind } from "./tokens.js";
export { KEYWORDS } from "./tokens.js";
export { connectStdioPlugin, servePlugin } from "./transport-stdio.js";
export { formatValue, valueEquals } from "./values.js";
export type { ToolArg, Value, ValueObject } from "./values.js";
export { createWorkspace } from "./workspace.js";
export type { Workspace } from "./workspace.js";
export { createNoFilesystemWorkspace } from "./workspace-none.js";
