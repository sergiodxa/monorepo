/**
 * The entry point for running specs inside a V8-isolate runtime — a Cloudflare
 * Worker and anything else without a process, a filesystem, or a shell.
 *
 * It exists because the difference is what a module may *import*, not what a run
 * may *do*: `plugins/db` imports Bun's SQL client, and `plugins/cli`,
 * `plugins/browser` and the stdio transport reach for the `Bun` global, so any
 * module importing them fails to load here however carefully a run is
 * permissioned. This surface therefore exports the language core plus the three
 * capabilities that are already pure — `http`, `url`, `jwt` — and nothing that
 * assumes a host. There is no `fs`, no `cli`, no `db` and no `env`; a spec naming
 * one gets an unknown-name failure, which is the honest answer, since no grant
 * could ever lift it.
 *
 * A browser capability is deliberately absent rather than missing: driving a
 * browser from here means calling a remote service over HTTP, which is a
 * different implementation of the same tool surface and belongs to whoever
 * chooses that service. Build it as a plugin and pass it to {@link runTests}
 * alongside these.
 *
 * `node:path` and `node:fs` are still reachable through the permission set's
 * host-filesystem check, so this needs the `nodejs_compat` flag; nothing calls
 * into them unless a host grant asks for a path outside a workspace, which a
 * hosted run never does.
 *
 * @example
 * ```ts
 * let loaded = loadSources([{ path: "flow.spec", text: source }]);
 * if (isFailure(loaded)) return loaded;
 * let outcome = await runTests({
 * 	suite: loaded.data,
 * 	plugins: [createHttpPlugin(), createUrlPlugin(), createJwtPlugin()],
 * 	grants: parseGrants(["--allow-net=app.example.com"]).data,
 * 	createWorkspace: createNoFilesystemWorkspace,
 * });
 * ```
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
export { parse } from "./parser";
export { createPermissionSet, parseGrants } from "./permissions";
export type { Grant, Grants, PermissionKind, PermissionSet } from "./permissions";
export type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "./plugin";
export { createHttpPlugin } from "./plugins/http";
export { createJwtPlugin } from "./plugins/jwt";
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
