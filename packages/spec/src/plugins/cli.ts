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

import { spawn } from "node:child_process";
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
	try {
		return success(await capture(executable, command.slice(1), context));
	} catch (error) {
		return failure(
			new ToolError(`cli.run failed to start "${executable}": ${describeError(error)}`),
		);
	}
}

/**
 * Run one program to completion inside the workspace and collect everything a
 * spec can assert on. A child terminated by a signal reports a nonzero
 * `exit_code`, so `expect exit_code is 0` cannot pass for it.
 *
 * @param executable - The program to run.
 * @param args - Its arguments, already validated as strings.
 * @param context - Supplies the workspace root and the granted variables.
 * @returns The captured stdout, stderr and exit code.
 * @throws When the program cannot be started at all.
 */
async function capture(
	executable: string,
	args: string[],
	context: ToolContext,
): Promise<{ stdout: string; stderr: string; exit_code: number }> {
	let child = spawn(executable, args, {
		cwd: context.workspace.root,
		env: childEnvironment(context),
		stdio: ["ignore", "pipe", "pipe"],
	});
	let stdout = "";
	let stderr = "";
	child.stdout?.setEncoding("utf8");
	child.stderr?.setEncoding("utf8");
	child.stdout?.on("data", (chunk: string) => void (stdout += chunk));
	child.stderr?.on("data", (chunk: string) => void (stderr += chunk));
	let code = await new Promise<number>((settle, reject) => {
		child.once("error", reject);
		child.once("close", (exitCode: number | null) => settle(exitCode ?? 1));
	});
	return { stdout, stderr, exit_code: code };
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
