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

export type * from "./ast";
export { BUILTIN_NAMESPACES, createBuiltinPlugins } from "./builtins";
export type { BuiltinNamespace } from "./builtins";
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
export { parse } from "./parser";
export { createPermissionSet, parseGrants } from "./permissions";
export type { Grant, Grants, PermissionKind, PermissionSet } from "./permissions";
export type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "./plugin";
export { createBrowserPlugin } from "./plugins/browser";
export { createCliPlugin } from "./plugins/cli";
export { createDbPlugin } from "./plugins/db";
export { createEnvPlugin } from "./plugins/env";
export { createFsPlugin } from "./plugins/fs";
export { createHttpPlugin } from "./plugins/http";
export { createJwtPlugin } from "./plugins/jwt";
export { createUrlPlugin } from "./plugins/url";
export { createRegistry } from "./registry";
export type { Registry, ResolvedCallable } from "./registry";
export { reportFatal, reportSuite } from "./reporter";
export { runTests } from "./run";
export type { RunTestsOptions, WorkspaceFactory } from "./run";
export { runSuite } from "./runner";
export type { RunOptions } from "./runner";
export { positionAt } from "./source";
export type { Position, SourceFile, Span } from "./source";
export { loadSources } from "./sources";
export type { LoadedSuite, SpecSource } from "./sources";
export type { Token, TokenKind } from "./tokens";
export { KEYWORDS } from "./tokens";
export { connectStdioPlugin, servePlugin } from "./transport-stdio";
export { formatValue, valueEquals } from "./values";
export type { ToolArg, Value, ValueObject } from "./values";
export { createWorkspace } from "./workspace";
export type { Workspace } from "./workspace";
export { createNoFilesystemWorkspace } from "./workspace-none";
