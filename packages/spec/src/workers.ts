/**
 * The entry point for running specs inside a V8-isolate runtime — a
 * Cloudflare Worker and anywhere else without a process, filesystem, or
 * shell. It exports the language core plus the pure `http`, `url`, `jwt`, and
 * `sample` capabilities; `db`, `cli`, `browser`, and stdio pull in Bun's SQL
 * client or the `Bun` global, so importing them would break here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Random, Seed } from "@sdxc/sample";

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
export { parse } from "./parser";
export { createPermissionSet, parseGrants } from "./permissions";
export type { Grant, Grants, PermissionKind, PermissionSet } from "./permissions";
export type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "./plugin";
export { createHttpPlugin } from "./plugins/http";
export { createJwtPlugin } from "./plugins/jwt";
export { createSamplePlugin } from "./plugins/sample";
export { createUrlPlugin } from "./plugins/url";
export { createRegistry } from "./registry";
export type { Registry, ResolvedCallable } from "./registry";
export { runTests } from "./run";
export type { RunTestsOptions, WorkspaceFactory } from "./run";
export { positionAt } from "./source";
export type { Position, SourceFile, Span } from "./source";
export { loadSources } from "./sources";
export type { LoadedSuite, SpecSource } from "./sources";
export type { Token, TokenKind } from "./tokens";
export { KEYWORDS } from "./tokens";
export { formatValue, valueEquals } from "./values";
export type { ToolArg, Value, ValueObject } from "./values";
export type { Workspace } from "./workspace";
export { createNoFilesystemWorkspace } from "./workspace-none";
