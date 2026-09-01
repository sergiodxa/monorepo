/**
 * Tests for the built-in `fs` plugin: workspace-scoped writes, reads, and
 * observable assertions, exercised against a real temporary directory behind
 * a minimal workspace stub.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve as resolvePath, sep } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, isSuccess, success } from "@pkg/result";
import { createRandom } from "@pkg/sample";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { PermissionSet } from "../permissions";
import type { ToolContext } from "../plugin";
import type { ToolArg, Value } from "../values";
import type { Workspace } from "../workspace";

import { ExpectationError, PermissionDeniedError, WorkspaceEscapeError } from "../errors";

import { createFsPlugin } from "./fs";

let plugin = createFsPlugin();
let root: string;
let context: ToolContext;

beforeEach(async () => {
	root = await realpath(await mkdtemp(join(tmpdir(), "spec-fs-plugin-")));
	context = {
		workspace: createWorkspaceStub(root),
		permissions: createPermissionsStub(),
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
	};
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

describe("createFsPlugin", () => {
	test("exposes the fs namespace and every documented tool", () => {
		expect(plugin.namespace).toBe("fs");
		let names = plugin.describe().map((descriptor) => descriptor.name);
		expect(names).toEqual([
			"write",
			"read",
			"mkdir",
			"remove",
			"copy",
			"exists",
			"file",
			"directory",
		]);
	});

	test("marks observables and actions, and requires no permission", () => {
		for (let descriptor of plugin.describe()) {
			let expected: "action" | "observable" = ["exists", "file", "directory"].includes(
				descriptor.name,
			)
				? "observable"
				: "action";
			expect(descriptor.kind).toBe(expected);
			expect(descriptor.requires).toBeUndefined();
		}
	});

	test("fails on a tool it does not expose", async () => {
		let error = expectFailure(await plugin.call("chmod", [value("x")], context));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('fs has no tool named "chmod"');
	});
});

describe("write", () => {
	test("writes a string verbatim, creating parent directories", async () => {
		let result = await plugin.call("write", [value("a/b/c.txt"), value("hello")], context);
		expect(expectSuccess(result)).toBeNull();
		expect(await readFile(join(root, "a/b/c.txt"), "utf8")).toBe("hello");
	});

	test("serializes an object as JSON with tabs and a trailing newline", async () => {
		let content: Value = { type: "module" };
		let result = await plugin.call("write", [value("package.json"), value(content)], context);
		expect(expectSuccess(result)).toBeNull();
		expect(await readFile(join(root, "package.json"), "utf8")).toBe('{\n\t"type": "module"\n}\n');
	});

	test("serializes an array as JSON with tabs and a trailing newline", async () => {
		let content: Value = [1, "two"];
		let result = await plugin.call("write", [value("list.json"), value(content)], context);
		expect(expectSuccess(result)).toBeNull();
		expect(await readFile(join(root, "list.json"), "utf8")).toBe('[\n\t1,\n\t"two"\n]\n');
	});

	test("rejects content that is neither string, object, nor array", async () => {
		let error = expectFailure(await plugin.call("write", [value("n.txt"), value(42)], context));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("must be a string, an object, or an array");
	});

	test("rejects a non-string path", async () => {
		let error = expectFailure(await plugin.call("write", [value(1), value("x")], context));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("fs.write expects a string for its path argument");
	});

	test("propagates the workspace resolver's escape failure", async () => {
		let error = expectFailure(
			await plugin.call("write", [value("../escape.txt"), value("x")], context),
		);
		expect(error.code).toBe("workspace-escape");
		expect(error).toBeInstanceOf(WorkspaceEscapeError);
	});

	test("propagates the workspace resolver's host-fs denial", async () => {
		let error = expectFailure(
			await plugin.call("write", [value("/etc/hosts"), value("x")], context),
		);
		expect(error.code).toBe("permission-denied");
	});
});

describe("read", () => {
	test("returns the file's content", async () => {
		await writeFile(join(root, "note.txt"), "content here");
		let result = await plugin.call("read", [value("note.txt")], context);
		expect(expectSuccess(result)).toBe("content here");
	});

	test("fails on a missing file", async () => {
		let error = expectFailure(await plugin.call("read", [value("missing.txt")], context));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('fs.read failed for "missing.txt"');
	});
});

describe("mkdir", () => {
	test("creates nested directories", async () => {
		let result = await plugin.call("mkdir", [value("x/y/z")], context);
		expect(expectSuccess(result)).toBeNull();
		let stats = await stat(join(root, "x/y/z"));
		expect(stats.isDirectory()).toBe(true);
	});
});

describe("remove", () => {
	test("removes a file", async () => {
		await writeFile(join(root, "gone.txt"), "x");
		let result = await plugin.call("remove", [value("gone.txt")], context);
		expect(expectSuccess(result)).toBeNull();
		expect(await exists(join(root, "gone.txt"))).toBe(false);
	});

	test("removes a directory and its contents with the recursive word", async () => {
		await mkdir(join(root, "dir/nested"), { recursive: true });
		await writeFile(join(root, "dir/nested/file.txt"), "x");
		let result = await plugin.call("remove", [value("dir"), word("recursive")], context);
		expect(expectSuccess(result)).toBeNull();
		expect(await exists(join(root, "dir"))).toBe(false);
	});

	test("fails on a missing path", async () => {
		let error = expectFailure(await plugin.call("remove", [value("nothing-here")], context));
		expect(error.code).toBe("tool-error");
	});

	test("rejects an unknown word, naming the accepted words", async () => {
		await writeFile(join(root, "keep.txt"), "x");
		let error = expectFailure(
			await plugin.call("remove", [value("keep.txt"), word("force")], context),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "force"');
		expect(error.message).toContain("accepted words: recursive");
	});
});

describe("copy", () => {
	test("copies a file, creating the destination's parent directories", async () => {
		await writeFile(join(root, "src.txt"), "payload");
		let result = await plugin.call("copy", [value("src.txt"), value("nested/dst.txt")], context);
		expect(expectSuccess(result)).toBeNull();
		expect(await readFile(join(root, "nested/dst.txt"), "utf8")).toBe("payload");
	});

	test("copies a directory recursively", async () => {
		await mkdir(join(root, "from/deep"), { recursive: true });
		await writeFile(join(root, "from/deep/file.txt"), "deep");
		let result = await plugin.call("copy", [value("from"), value("to")], context);
		expect(expectSuccess(result)).toBeNull();
		expect(await readFile(join(root, "to/deep/file.txt"), "utf8")).toBe("deep");
	});

	test("fails when the source is missing", async () => {
		let error = expectFailure(
			await plugin.call("copy", [value("absent"), value("anywhere")], context),
		);
		expect(error.code).toBe("tool-error");
	});
});

describe("exists", () => {
	test("reports true for a present entry and false for an absent one", async () => {
		await writeFile(join(root, "present.txt"), "x");
		expect(expectSuccess(await plugin.call("exists", [value("present.txt")], context))).toBe(true);
		expect(expectSuccess(await plugin.call("exists", [value("absent.txt")], context))).toBe(false);
	});
});

describe("file", () => {
	test("exists passes for a real file", async () => {
		await writeFile(join(root, "real.txt"), "x");
		let result = await plugin.call("file", [value("real.txt"), word("exists")], context);
		expect(expectSuccess(result)).toBe(true);
	});

	test("exists fails for a missing file with the documented message", async () => {
		let error = expectFailure(
			await plugin.call("file", [value("missing.txt"), word("exists")], context),
		);
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toBe("file missing.txt does not exist");
	});

	test("exists fails when the path is a directory, not a file", async () => {
		await mkdir(join(root, "a-dir"));
		let error = expectFailure(await plugin.call("file", [value("a-dir"), word("exists")], context));
		expect(error.code).toBe("expectation-failed");
	});

	test("contains passes when the substring is present", async () => {
		await writeFile(join(root, "app.js"), 'console.log("hello")\n');
		let result = await plugin.call(
			"file",
			[value("app.js"), word("contains"), value("console.log")],
			context,
		);
		expect(expectSuccess(result)).toBe(true);
	});

	test("contains fails carrying expected and observed", async () => {
		await writeFile(join(root, "app.js"), "actual content\n");
		let error = expectFailure(
			await plugin.call("file", [value("app.js"), word("contains"), value("needle")], context),
		);
		expect(error).toBeInstanceOf(ExpectationError);
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toContain("does not contain");
		if (error instanceof ExpectationError) {
			expect(error.expected).toBe("needle");
			expect(error.observed).toBe("actual content\n");
		}
	});

	test("contains fails as non-existence when the file is missing", async () => {
		let error = expectFailure(
			await plugin.call("file", [value("nope.txt"), word("contains"), value("x")], context),
		);
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toBe("file nope.txt does not exist");
	});

	test("contains demands a string to look for", async () => {
		await writeFile(join(root, "app.js"), "x");
		let error = expectFailure(
			await plugin.call("file", [value("app.js"), word("contains")], context),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("expected argument");
	});

	test("rejects an unknown word, naming the accepted words", async () => {
		let error = expectFailure(await plugin.call("file", [value("x"), word("shrinks")], context));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('does not understand the word "shrinks"');
		expect(error.message).toContain("accepted words: exists, contains");
	});

	test("rejects a string value where a word is expected", async () => {
		let error = expectFailure(await plugin.call("file", [value("x"), value("exists")], context));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("expects a bare word");
	});
});

describe("directory", () => {
	test("exists passes for a real directory", async () => {
		await mkdir(join(root, "sub"));
		let result = await plugin.call("directory", [value("sub"), word("exists")], context);
		expect(expectSuccess(result)).toBe(true);
	});

	test("exists fails for a missing directory with the documented message", async () => {
		let error = expectFailure(
			await plugin.call("directory", [value("nope"), word("exists")], context),
		);
		expect(error.code).toBe("expectation-failed");
		expect(error.message).toBe("directory nope does not exist");
	});

	test("exists fails when the path is a file, not a directory", async () => {
		await writeFile(join(root, "plain.txt"), "x");
		let error = expectFailure(
			await plugin.call("directory", [value("plain.txt"), word("exists")], context),
		);
		expect(error.code).toBe("expectation-failed");
	});

	test("rejects an unknown word, naming the accepted word", async () => {
		let error = expectFailure(
			await plugin.call("directory", [value("x"), word("contains")], context),
		);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("accepted words: exists");
	});
});

/** Build a workspace over a real temp directory with the contract's path rules. */
function createWorkspaceStub(base: string): Workspace {
	return {
		root: base,
		resolve(input: string) {
			if (isAbsolute(input)) {
				return failure(new PermissionDeniedError("host-fs", input, "spec run --allow-host-fs=/"));
			}
			let resolved = resolvePath(base, input);
			if (resolved !== base && !resolved.startsWith(base + sep)) {
				return failure(new WorkspaceEscapeError(input));
			}
			return success(resolved);
		},
		async cleanup(): Promise<undefined> {
			await rm(base, { recursive: true, force: true });
			return undefined;
		},
	};
}

/** A permission set granting every check, filling the tool context's shape for fs tests. */
function createPermissionsStub(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** Whether anything exists at an absolute host path. */
async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/** Narrow to the success data or fail the test with the error's message. */
function expectSuccess<T, E extends Error>(result: Result<T, E>): T {
	if (isFailure(result)) throw new Error(`Expected success, got: ${result.error.message}`);
	return result.data;
}

/** Narrow to the failure error or fail the test with the unexpected data. */
function expectFailure<T, E extends Error>(result: Result<T, E>): E {
	if (isSuccess(result)) throw new Error(`Expected failure, got: ${JSON.stringify(result.data)}`);
	return result.error;
}
