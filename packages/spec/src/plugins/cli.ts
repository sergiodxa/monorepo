/**
 * The built-in `cli` capability: run programs inside the test workspace. The
 * `run` permission gates every call by the executable's basename, and child
 * processes receive a minimal filtered environment — PATH/HOME/TMPDIR plus
 * exactly the variables granted with `--allow-env` — so the host environment
 * never leaks into a spec's subprocesses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basename } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value } from "../values";

import { ToolError } from "../errors";
import { formatValue } from "../values";

/** Host variables every child needs to execute at all; always forwarded. */
const BASE_ENV_NAMES = ["PATH", "HOME", "TMPDIR"];

/** Descriptors of every tool the `cli` namespace exposes. */
const CLI_TOOLS: ToolDescriptor[] = [
	{
		name: "run",
		summary: "Run an executable inside the workspace and capture its output.",
		kind: "action",
		requires: "run",
		params: [
			{
				name: "executable",
				kind: "value",
				required: true,
				summary: "The program to run; permission-checked by its basename.",
			},
			{
				name: "args",
				kind: "value",
				required: false,
				summary: "Arguments passed to the program, each a string.",
			},
		],
	},
];

/**
 * Create the built-in `cli` plugin: a single `run` tool that spawns a child
 * process with its working directory at the workspace root and a filtered
 * environment, and reports `{ stdout, stderr, exit_code }`.
 */
export function createCliPlugin(): Plugin {
	return {
		namespace: "cli",
		describe() {
			return CLI_TOOLS;
		},
		async call(tool, args, context) {
			if (tool !== "run") {
				return failure(new ToolError(`cli has no tool named "${tool}"; tools: run`));
			}
			return await run(args, context);
		},
	};
}

/** `cli.run executable args…` — spawn, wait, and capture stdout/stderr. */
async function run(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let command: string[] = [];
	for (let [index, arg] of args.entries()) {
		if (arg.kind === "word") {
			return failure(
				new ToolError(
					`cli.run arguments must all be strings; argument ${index + 1} is the bare word "${arg.word}"`,
				),
			);
		}
		if (typeof arg.value !== "string") {
			return failure(
				new ToolError(
					`cli.run arguments must all be strings; argument ${index + 1} is ${formatValue(arg.value)}`,
				),
			);
		}
		command.push(arg.value);
	}
	let executable = command[0];
	if (executable === undefined) {
		return failure(new ToolError("cli.run expects an executable as its first argument"));
	}
	let allowed = context.permissions.checkRun(basename(executable));
	if (isFailure(allowed)) return allowed;
	let cmd: [string, ...string[]] = [executable, ...command.slice(1)];
	try {
		let child = Bun.spawn({
			cmd,
			cwd: context.workspace.root,
			env: childEnvironment(context),
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		let [stdout, stderr, exitCode] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited,
		]);
		return success({ stdout, stderr, exit_code: exitCode });
	} catch (error) {
		return failure(
			new ToolError(`cli.run failed to start "${executable}": ${describeError(error)}`),
		);
	}
}

/**
 * Build the child's environment: PATH/HOME/TMPDIR from the host plus exactly
 * the variables the caller granted with `--allow-env`, skipping any granted
 * name the host does not actually define.
 */
function childEnvironment(context: ToolContext): Record<string, string> {
	let env: Record<string, string> = {};
	for (let name of [...BASE_ENV_NAMES, ...context.permissions.grantedEnvNames()]) {
		let value = process.env[name];
		if (value !== undefined) env[name] = value;
	}
	return env;
}

/** Render an unknown thrown value as a one-line message. */
function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
