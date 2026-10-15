/**
 * Command lines declared as a contract and mapped to handlers: `commands`, `command`,
 * `argument`, `flag` and `prompt` declare what a program takes, `createCLI` maps handlers onto
 * it and runs it, and every handler answers a `Result` that decides the exit code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Argument,
	ArgumentOptions,
	ArgumentValue,
	SingleArgumentOptions,
	VariadicArgumentOptions,
} from "./argument.js";
export type { Binding, CLI, CLIOptions } from "./cli.js";
export type {
	ArgumentsOf,
	ArgumentsShape,
	Command,
	CommandDefinition,
	FlagsOf,
	FlagsShape,
	Group,
	GroupDefinition,
	GroupInputs,
	Node,
} from "./command.js";
export type { AnyCommandContext, CommandContextInit } from "./context.js";
export type { Exec, ExecOptions, ExecOutput, ExecRequest, Stdio } from "./exec.js";
export type {
	BooleanFlagOptions,
	Flag,
	FlagKind,
	FlagOptions,
	FlagValue,
	ValueFlag,
	ValueFlagOptions,
} from "./flag.js";
export type {
	ChainContext,
	CLITypes,
	CommandAction,
	CommandHandler,
	HandlerContext,
} from "./handler.js";
export type { Input } from "./keys.js";
export type { Lazy } from "./lazy.js";
export type {
	AnyCommandMiddleware,
	ChainProperties,
	CommandMiddleware,
	CommandResult,
	ContextEffect,
	EmptyContextEffect,
	NextFunction,
} from "./middleware.js";
export type {
	Ask,
	AskOptions,
	Choice,
	Choices,
	ConfirmOptions,
	MultiselectOptions,
	NumberOptions,
	PasswordOptions,
	PromptDeclaration,
	PromptError,
	PromptKind,
	Prompter,
	SearchOptions,
	SelectOptions,
	TextOptions,
} from "./prompt.js";
export type { Output } from "./screen.js";
export type { RunIO } from "./session.js";
export type { Env, Paint, Style } from "./style.js";
export type { RunTask, Task, TaskResult } from "./task.js";

export { argument } from "./argument.js";
export { createCLI } from "./cli.js";
export { command, commands } from "./command.js";
export { CommandContext } from "./context.js";
export {
	CancelledError,
	EXIT_CODES,
	ExitError,
	UsageError,
	cancelled,
	exit,
	success,
	usage,
} from "./errors.js";
export { ExecError, spawnExec } from "./exec.js";
export { flag } from "./flag.js";
export { createCommand } from "./handler.js";
export { lazy } from "./lazy.js";
export { prompt } from "./prompt.js";
export { createStyle } from "./style.js";
export { failure } from "@sdxc/result";
