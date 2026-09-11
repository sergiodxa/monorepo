/**
 * The entry point for running specs inside a V8-isolate runtime — a
 * Cloudflare Worker and anywhere else without a process, filesystem, or
 * shell. It exports the language core plus the pure `http`, `url`, `jwt`,
 * `sample`, `html`, `str`, and `spec` capabilities, each of which computes
 * from its arguments or from the run's own identity; `db`, `cli`, `browser`,
 * and stdio pull in Bun's SQL client or the `Bun` global, so importing them
 * would break here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Random, Seed } from "@sdxc/sample";

export type { ArtifactStore } from "./artifacts.js";
export type * from "./ast.js";
export { createBaseSet, createConnectionSet } from "./bases.js";
export type { Base, BaseSet, Connection, ConnectionSet } from "./bases.js";
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
export { parse } from "./parser.js";
export { createPermissionSet, parseGrants } from "./permissions.js";
export type { Grant, Grants, PermissionKind, PermissionSet } from "./permissions.js";
export type { Plugin, RunIdentity, ToolContext, ToolDescriptor, ToolParam } from "./plugin.js";
export { createHtmlPlugin } from "./plugins/html.js";
export { createHttpPlugin } from "./plugins/http.js";
export { createJwtPlugin } from "./plugins/jwt.js";
export { createSamplePlugin } from "./plugins/sample.js";
export { createSpecPlugin } from "./plugins/spec.js";
export { createStrPlugin } from "./plugins/str.js";
export { createUrlPlugin } from "./plugins/url.js";
export { createRegistry } from "./registry.js";
export type { Registry, ResolvedCallable } from "./registry.js";
export { createRunId, runTests } from "./run.js";
export type { RunTestsOptions, WorkspaceFactory } from "./run.js";
export { positionAt } from "./source.js";
export type { Position, SourceFile, Span } from "./source.js";
export { loadSources } from "./sources.js";
export type { LoadedSuite, SpecSource } from "./sources.js";
export type { Token, TokenKind } from "./tokens.js";
export { KEYWORDS } from "./tokens.js";
export { formatValue, valueEquals } from "./values.js";
export type { ToolArg, Value, ValueObject } from "./values.js";
export type { Workspace } from "./workspace.js";
export { createNoFilesystemWorkspace } from "./workspace-none.js";
