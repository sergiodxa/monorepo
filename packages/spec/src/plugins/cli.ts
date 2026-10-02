/**
 * The built-in `cli` capability: run programs to completion, or start long-lived
 * ones such as a dev server and stop them later. The `run` permission gates every
 * program by its basename, and children receive only PATH/HOME/TMPDIR plus the
 * variables granted with `--allow-env`, so the host environment stays out of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spawn } from "node:child_process";
import { basename, resolve as resolvePath } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { ExpectationError, ToolError } from "../errors.js";
import { formatValue } from "../values.js";

import type { ChildProcess } from "node:child_process";

/** Host variables every child needs to execute at all; always forwarded. */
const BASE_ENV_NAMES = ["PATH", "HOME", "TMPDIR"];

/** How long a stopped program has to exit on SIGTERM before it is killed outright. */
const STOP_GRACE_MS = 5000;

/** The `in <directory>` option `run` and `start` share. */
const IN_PARAM: ToolParam = {
	name: "in",
	kind: "word",
	required: false,
	summary:
		"`in <directory>` runs the program there, resolved against where `spec run` was invoked.",
};

/** The program and arguments `run` and `start` share. */
const COMMAND_PARAMS: ToolParam[] = [
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
	IN_PARAM,
];

/** The handle `start` returns, which `output` and `stop` take. */
const PROCESS_PARAM: ToolParam = {
	name: "process",
	kind: "value",
	required: true,
	summary: "The handle `cli.start` returned.",
};

/** Descriptors of every tool the `cli` namespace exposes. */
const CLI_TOOLS: ToolDescriptor[] = [
	{
		name: "run",
		summary: "Run an executable to completion and capture its output.",
		kind: "action",
		requires: "run",
		params: COMMAND_PARAMS,
	},
	{
		name: "start",
		summary: "Start an executable and return while it keeps running, until `stop` or the run ends.",
		kind: "action",
		requires: "run",
		params: COMMAND_PARAMS,
	},
	{
		name: "output",
		summary: "Everything a started program printed so far, or assert it `contains` a substring.",
		kind: "observable",
		params: [
			PROCESS_PARAM,
			{
				name: "contains",
				kind: "word",
				required: false,
				summary: "`contains <text>` asserts the output includes the text.",
			},
		],
	},
	{
		name: "stop",
		summary: "Stop a started program and report its exit code and everything it printed.",
		kind: "action",
		params: [PROCESS_PARAM],
	},
];

/** A program `start` launched, tracked until it is stopped or the run ends. */
interface Started {
	child: ChildProcess;
	/** stdout and stderr interleaved in the order they arrived. */
	output: string;
	/** Settles with the exit code once the program has exited and its streams have closed. */
	exited: Promise<number>;
	/** The exit code, once `exited` has settled. */
	exitCode: number | undefined;
}

/** What `run` and `start` were asked to launch. */
interface Command {
	executable: string;
	args: string[];
	/** The working directory, the test workspace unless `in` named one. */
	cwd: string;
}

/**
 * Create the built-in `cli` plugin. A program `start` launches belongs to the
 * run rather than to the test or hook that started it, so a server started in
 * `setup` serves every test; disposing the plugin stops whatever is still running.
 */
export function createCliPlugin(): Plugin {
	let started = new Map<string, Started>();
	let nextId = 1;

	return {
		namespace: "cli",
		describe() {
			return CLI_TOOLS;
		},
		async call(tool, args, context) {
			if (tool === "run") return await run(args, context);
			if (tool === "start") {
				let launched = await start(args, context);
				if (isFailure(launched)) return launched;
				let id = String(nextId++);
				started.set(id, launched.data);
				return success({ id, pid: launched.data.child.pid ?? null });
			}
			if (tool === "output") return output(started, args);
			if (tool === "stop") return await stopTool(started, args);
			return failure(
				new ToolError(`cli has no tool named "${tool}"; tools: run, start, output, stop`),
			);
		},
		async dispose() {
			await Promise.all([...started.values()].map((program) => stop(program)));
			started.clear();
		},
	};
}

/** `cli.run executable args… [in dir]` — spawn, wait, and capture stdout/stderr. */
async function run(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let command = readCommand("run", args, context);
	if (isFailure(command)) return command;
	try {
		return success(await capture(command.data, context));
	} catch (error) {
		return failure(
			new ToolError(
				`cli.run failed to start "${command.data.executable}": ${describeError(error)}`,
			),
		);
	}
}

/**
 * `cli.start executable args… [in dir]` — launch a program in its own process
 * group and return once it is running. The group is what `stop` signals, so a
 * script that spawns the real server (`bun run dev`) takes that server down too.
 */
async function start(args: ToolArg[], context: ToolContext): Promise<Result<Started, SpecError>> {
	let command = readCommand("start", args, context);
	if (isFailure(command)) return command;
	let child = spawn(command.data.executable, command.data.args, {
		cwd: command.data.cwd,
		env: childEnvironment(context),
		stdio: ["ignore", "pipe", "pipe"],
		detached: true,
	});
	let program: Started = { child, output: "", exited: Promise.resolve(0), exitCode: undefined };
	child.stdout?.setEncoding("utf8");
	child.stderr?.setEncoding("utf8");
	child.stdout?.on("data", (chunk: string) => void (program.output += chunk));
	child.stderr?.on("data", (chunk: string) => void (program.output += chunk));
	program.exited = new Promise<number>((settle) => {
		child.once("close", (exitCode: number | null) => {
			program.exitCode = exitCode ?? 1;
			settle(program.exitCode);
		});
	});
	let spawned = await new Promise<Error | undefined>((settle) => {
		child.once("spawn", () => settle(undefined));
		child.once("error", settle);
	});
	if (spawned !== undefined) {
		return failure(
			new ToolError(
				`cli.start failed to start "${command.data.executable}": ${describeError(spawned)}`,
			),
		);
	}
	return success(program);
}

/**
 * `cli.output process [contains text]` — read what a started program printed,
 * or assert on it. A program that already exited says so in the failure, which
 * is the diagnosis when an `eventually` waits on a server that crashed on boot.
 */
function output(started: Map<string, Started>, args: ToolArg[]): Result<Value, SpecError> {
	let program = findStarted("output", started, args[0]);
	if (isFailure(program)) return program;
	let selector = args[1];
	if (selector === undefined) return success(program.data.output);
	if (selector.kind !== "word" || selector.word !== "contains") {
		return failure(
			new ToolError("cli.output takes the process, then optionally `contains <text>`"),
		);
	}
	let expected = args[2];
	if (expected?.kind !== "value" || typeof expected.value !== "string" || args.length > 3) {
		return failure(new ToolError("cli.output contains expects the text to look for, a string"));
	}
	if (program.data.output.includes(expected.value)) return success(true);
	let state =
		program.data.exitCode === undefined
			? "is still running"
			: `exited with code ${program.data.exitCode}`;
	return failure(
		new ExpectationError(
			`the program's output does not contain ${formatValue(expected.value)}, and it ${state}`,
			expected.value,
			program.data.output,
		),
	);
}

/** `cli.stop process` — stop a started program and report how it ended. */
async function stopTool(
	started: Map<string, Started>,
	args: ToolArg[],
): Promise<Result<Value, SpecError>> {
	if (args.length !== 1)
		return failure(new ToolError("cli.stop takes exactly the process to stop"));
	let program = findStarted("stop", started, args[0]);
	if (isFailure(program)) return program;
	let exitCode = await stop(program.data);
	return success({ exit_code: exitCode, output: program.data.output });
}

/**
 * Signal a started program's process group with SIGTERM, escalating to SIGKILL
 * once {@link STOP_GRACE_MS} passes. A program that already exited reports the
 * code it exited with.
 */
async function stop(program: Started): Promise<number> {
	if (program.exitCode !== undefined) return program.exitCode;
	signalGroup(program.child, "SIGTERM");
	let timer = setTimeout(() => signalGroup(program.child, "SIGKILL"), STOP_GRACE_MS);
	let exitCode = await program.exited;
	clearTimeout(timer);
	return exitCode;
}

/** Signal every process in a started program's group, tolerating one already gone. */
function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
	if (child.pid === undefined) return;
	try {
		process.kill(-child.pid, signal);
	} catch {
		child.kill(signal);
	}
}

/** Resolve the handle `start` returned into the program it names. */
function findStarted(
	tool: string,
	started: Map<string, Started>,
	arg: ToolArg | undefined,
): Result<Started, SpecError> {
	let handle = arg?.kind === "value" ? arg.value : undefined;
	let id =
		handle !== null && typeof handle === "object" && !Array.isArray(handle) ? handle.id : undefined;
	let program = typeof id === "string" ? started.get(id) : undefined;
	if (program === undefined) {
		return failure(
			new ToolError(`cli.${tool} expects the handle cli.start returned as its first argument`),
		);
	}
	return success(program);
}

/**
 * Read the program, its arguments and the optional trailing `in <directory>`,
 * checking the `run` grant for the program and the host filesystem grant for a
 * directory outside the workspace.
 */
function readCommand(
	tool: string,
	args: ToolArg[],
	context: ToolContext,
): Result<Command, SpecError> {
	let words: string[] = [];
	let directory: string | undefined;
	for (let [index, arg] of args.entries()) {
		if (arg.kind === "word" && arg.word === "in") {
			let target = args[index + 1];
			if (
				target?.kind !== "value" ||
				typeof target.value !== "string" ||
				index + 2 !== args.length
			) {
				return failure(
					new ToolError(`cli.${tool} expects \`in\` last, followed by the directory as a string`),
				);
			}
			directory = target.value;
			break;
		}
		if (arg.kind === "word") {
			return failure(
				new ToolError(
					`cli.${tool} arguments must all be strings; argument ${index + 1} is the bare word "${arg.word}"`,
				),
			);
		}
		if (typeof arg.value !== "string") {
			return failure(
				new ToolError(
					`cli.${tool} arguments must all be strings; argument ${index + 1} is ${formatValue(arg.value)}`,
				),
			);
		}
		words.push(arg.value);
	}
	let executable = words[0];
	if (executable === undefined) {
		return failure(new ToolError(`cli.${tool} expects an executable as its first argument`));
	}
	let allowed = context.permissions.checkRun(basename(executable));
	if (isFailure(allowed)) return allowed;
	let cwd = context.workspace.root;
	if (directory !== undefined) {
		cwd = resolvePath(process.cwd(), directory);
		let reachable = context.permissions.checkHostFs(cwd);
		if (isFailure(reachable)) return reachable;
	}
	return success({ executable, args: words.slice(1), cwd });
}

/**
 * Run one program to completion inside the workspace and collect everything a
 * spec can assert on. A child terminated by a signal reports a nonzero
 * `exit_code`, so `expect exit_code is 0` cannot pass for it.
 *
 * @param command - The program, its arguments and the directory it runs in.
 * @param context - Supplies the granted variables.
 * @returns The captured stdout, stderr and exit code.
 * @throws When the program cannot be started at all.
 */
async function capture(
	command: Command,
	context: ToolContext,
): Promise<{ stdout: string; stderr: string; exit_code: number }> {
	let child = spawn(command.executable, command.args, {
		cwd: command.cwd,
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
