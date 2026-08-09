/**
 * The built-in `fs` capability: workspace-scoped filesystem tools for
 * writing, reading, and observing files. Every path a spec supplies flows
 * through the workspace's safe resolver before any I/O happens, so these
 * tools are workspace-safe and demand no permission grant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";

import { ExpectationError, ToolError } from "../errors";
import { formatValue } from "../values";

/** Words the `file` observable accepts as its assertion selector. */
const FILE_WORDS = ["exists", "contains"];

/** Words the `directory` observable accepts as its assertion selector. */
const DIRECTORY_WORDS = ["exists"];

/** Words the `remove` action accepts after the path. */
const REMOVE_WORDS = ["recursive"];

/** Descriptors of every tool the `fs` namespace exposes. */
const FS_TOOLS: ToolDescriptor[] = [
	{
		name: "write",
		summary: "Write content to a workspace file, creating parent directories.",
		kind: "action",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Workspace path of the file to write.",
			},
			{
				name: "content",
				kind: "value",
				required: true,
				summary: "A string written verbatim; an object or array is serialized as JSON.",
			},
		],
	},
	{
		name: "read",
		summary: "Read a workspace file as UTF-8 text.",
		kind: "action",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Workspace path of the file to read.",
			},
		],
	},
	{
		name: "mkdir",
		summary: "Create a directory (and any missing parents) in the workspace.",
		kind: "action",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Workspace path of the directory to create.",
			},
		],
	},
	{
		name: "remove",
		summary: "Delete a workspace file, or a directory with the `recursive` word.",
		kind: "action",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Workspace path of the entry to delete.",
			},
			{
				name: "recursive",
				kind: "word",
				required: false,
				summary: "Pass the word `recursive` to delete a directory and its contents.",
			},
		],
	},
	{
		name: "copy",
		summary: "Copy a workspace file or directory to another workspace path.",
		kind: "action",
		params: [
			{ name: "from", kind: "value", required: true, summary: "Workspace path to copy from." },
			{ name: "to", kind: "value", required: true, summary: "Workspace path to copy to." },
		],
	},
	{
		name: "exists",
		summary: "Observe whether anything exists at a workspace path.",
		kind: "observable",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Workspace path to check for existence.",
			},
		],
	},
	{
		name: "file",
		summary: "Assert on a workspace file: `exists`, or `contains` a substring.",
		kind: "observable",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Workspace path of the file to inspect.",
			},
			{
				name: "assertion",
				kind: "word",
				required: true,
				summary: "One of the words `exists` or `contains`.",
			},
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "The substring `contains` demands the file to include.",
			},
		],
	},
	{
		name: "directory",
		summary: "Assert on a workspace directory: `exists`.",
		kind: "observable",
		params: [
			{
				name: "path",
				kind: "value",
				required: true,
				summary: "Workspace path of the directory to inspect.",
			},
			{
				name: "assertion",
				kind: "word",
				required: true,
				summary: "The word `exists`.",
			},
		],
	},
];

/**
 * Create the built-in `fs` plugin: the `fs` namespace of workspace-scoped
 * filesystem tools. All tools resolve their paths through the workspace's
 * safety boundary, so escapes fail before any I/O happens.
 */
export function createFsPlugin(): Plugin {
	return {
		namespace: "fs",
		describe() {
			return FS_TOOLS;
		},
		async call(tool, args, context) {
			switch (tool) {
				case "write":
					return await write(args, context);
				case "read":
					return await read(args, context);
				case "mkdir":
					return await makeDirectory(args, context);
				case "remove":
					return await remove(args, context);
				case "copy":
					return await copy(args, context);
				case "exists":
					return await exists(args, context);
				case "file":
					return await file(args, context);
				case "directory":
					return await directory(args, context);
				default: {
					let names = FS_TOOLS.map((descriptor) => descriptor.name).join(", ");
					return failure(new ToolError(`fs has no tool named "${tool}"; tools: ${names}`));
				}
			}
		},
	};
}

/** `fs.write path content` — write a file, creating parent directories. */
async function write(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let specPath = stringArg(args, 0, "write", "path");
	if (isFailure(specPath)) return specPath;
	let content = args[1];
	if (content === undefined || content.kind !== "value") {
		return failure(new ToolError("fs.write expects a content value as its second argument"));
	}
	let serialized = serializeContent(content.value);
	if (isFailure(serialized)) return serialized;
	let resolved = context.workspace.resolve(specPath.data);
	if (isFailure(resolved)) return resolved;
	try {
		await mkdir(dirname(resolved.data), { recursive: true });
		await writeFile(resolved.data, serialized.data, "utf8");
		return success(null);
	} catch (error) {
		return failure(
			new ToolError(`fs.write failed for "${specPath.data}": ${describeError(error)}`),
		);
	}
}

/** `fs.read path` — read a workspace file as UTF-8 text. */
async function read(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let specPath = stringArg(args, 0, "read", "path");
	if (isFailure(specPath)) return specPath;
	let resolved = context.workspace.resolve(specPath.data);
	if (isFailure(resolved)) return resolved;
	try {
		let content = await readFile(resolved.data, "utf8");
		return success(content);
	} catch (error) {
		return failure(new ToolError(`fs.read failed for "${specPath.data}": ${describeError(error)}`));
	}
}

/** `fs.mkdir path` — create a directory and any missing parents. */
async function makeDirectory(
	args: ToolArg[],
	context: ToolContext,
): Promise<Result<Value, SpecError>> {
	let specPath = stringArg(args, 0, "mkdir", "path");
	if (isFailure(specPath)) return specPath;
	let resolved = context.workspace.resolve(specPath.data);
	if (isFailure(resolved)) return resolved;
	try {
		await mkdir(resolved.data, { recursive: true });
		return success(null);
	} catch (error) {
		return failure(
			new ToolError(`fs.mkdir failed for "${specPath.data}": ${describeError(error)}`),
		);
	}
}

/** `fs.remove path [recursive]` — delete a file, or a directory with `recursive`. */
async function remove(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let specPath = stringArg(args, 0, "remove", "path");
	if (isFailure(specPath)) return specPath;
	let recursive = false;
	if (args.length > 1) {
		let selector = wordArg(args, 1, "remove", REMOVE_WORDS);
		if (isFailure(selector)) return selector;
		recursive = true;
	}
	let resolved = context.workspace.resolve(specPath.data);
	if (isFailure(resolved)) return resolved;
	try {
		await rm(resolved.data, { recursive });
		return success(null);
	} catch (error) {
		return failure(
			new ToolError(`fs.remove failed for "${specPath.data}": ${describeError(error)}`),
		);
	}
}

/** `fs.copy from to` — copy a file or directory inside the workspace. */
async function copy(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let from = stringArg(args, 0, "copy", "from");
	if (isFailure(from)) return from;
	let to = stringArg(args, 1, "copy", "to");
	if (isFailure(to)) return to;
	let resolvedFrom = context.workspace.resolve(from.data);
	if (isFailure(resolvedFrom)) return resolvedFrom;
	let resolvedTo = context.workspace.resolve(to.data);
	if (isFailure(resolvedTo)) return resolvedTo;
	try {
		await mkdir(dirname(resolvedTo.data), { recursive: true });
		await cp(resolvedFrom.data, resolvedTo.data, { recursive: true });
		return success(null);
	} catch (error) {
		return failure(
			new ToolError(`fs.copy failed from "${from.data}" to "${to.data}": ${describeError(error)}`),
		);
	}
}

/** `fs.exists path` — observe whether anything exists at the path. */
async function exists(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let specPath = stringArg(args, 0, "exists", "path");
	if (isFailure(specPath)) return specPath;
	let resolved = context.workspace.resolve(specPath.data);
	if (isFailure(resolved)) return resolved;
	try {
		await stat(resolved.data);
		return success(true);
	} catch {
		return success(false);
	}
}

/** `fs.file path exists|contains [expected]` — checked file assertions. */
async function file(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let specPath = stringArg(args, 0, "file", "path");
	if (isFailure(specPath)) return specPath;
	let selector = wordArg(args, 1, "file", FILE_WORDS);
	if (isFailure(selector)) return selector;
	let resolved = context.workspace.resolve(specPath.data);
	if (isFailure(resolved)) return resolved;
	if (selector.data === "exists") {
		let isFile = false;
		try {
			let stats = await stat(resolved.data);
			isFile = stats.isFile();
		} catch {
			isFile = false;
		}
		if (isFile) return success(true);
		return failure(new ExpectationError(`file ${specPath.data} does not exist`));
	}
	let expected = stringArg(args, 2, "file", "expected");
	if (isFailure(expected)) return expected;
	let content: string;
	try {
		content = await readFile(resolved.data, "utf8");
	} catch {
		return failure(new ExpectationError(`file ${specPath.data} does not exist`));
	}
	if (content.includes(expected.data)) return success(true);
	return failure(
		new ExpectationError(
			`file ${specPath.data} does not contain ${formatValue(expected.data)}`,
			expected.data,
			content,
		),
	);
}

/** `fs.directory path exists` — checked directory assertion. */
async function directory(args: ToolArg[], context: ToolContext): Promise<Result<Value, SpecError>> {
	let specPath = stringArg(args, 0, "directory", "path");
	if (isFailure(specPath)) return specPath;
	let selector = wordArg(args, 1, "directory", DIRECTORY_WORDS);
	if (isFailure(selector)) return selector;
	let resolved = context.workspace.resolve(specPath.data);
	if (isFailure(resolved)) return resolved;
	let isDirectory = false;
	try {
		let stats = await stat(resolved.data);
		isDirectory = stats.isDirectory();
	} catch {
		isDirectory = false;
	}
	if (isDirectory) return success(true);
	return failure(new ExpectationError(`directory ${specPath.data} does not exist`));
}

/**
 * Turn `fs.write` content into file text: strings are written verbatim,
 * objects and arrays become JSON with tab indentation and a trailing newline.
 */
function serializeContent(content: Value): Result<string, ToolError> {
	if (typeof content === "string") return success(content);
	if (Array.isArray(content) || isValueObject(content)) {
		return success(`${JSON.stringify(content, null, "\t")}\n`);
	}
	return failure(
		new ToolError(
			`fs.write content must be a string, an object, or an array; got ${formatValue(content)}`,
		),
	);
}

/** Narrow a value to a plain object (not an array, not null). */
function isValueObject(value: Value): value is ValueObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract a required string argument, failing with the tool's usage when the
 * argument is missing, a bare word, or not a string.
 */
function stringArg(
	args: ToolArg[],
	index: number,
	tool: string,
	name: string,
): Result<string, ToolError> {
	let arg = args[index];
	if (arg === undefined || arg.kind !== "value" || typeof arg.value !== "string") {
		return failure(
			new ToolError(`fs.${tool} expects a string for its ${name} argument (position ${index + 1})`),
		);
	}
	return success(arg.value);
}

/**
 * Extract a bare-word argument and validate it against the tool's accepted
 * words, naming them all on any mismatch.
 */
function wordArg(
	args: ToolArg[],
	index: number,
	tool: string,
	accepted: string[],
): Result<string, ToolError> {
	let arg = args[index];
	if (arg === undefined || arg.kind !== "word") {
		return failure(
			new ToolError(
				`fs.${tool} expects a bare word as argument ${index + 1}; accepted words: ${accepted.join(", ")}`,
			),
		);
	}
	if (!accepted.includes(arg.word)) {
		return failure(
			new ToolError(
				`fs.${tool} does not understand the word "${arg.word}"; accepted words: ${accepted.join(", ")}`,
			),
		);
	}
	return success(arg.word);
}

/** Render an unknown thrown value as a one-line message. */
function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
