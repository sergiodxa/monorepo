/**
 * Tests for suite loading: recursive `.spec` discovery in lexicographic
 * order, parse failures aborting the load with the file named, and
 * suite-global definition registration with duplicate detection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { isFailure, isSuccess } from "@pkg/result";

import { LoadError, ParseError } from "./errors";
import { loadSuite } from "./loader";

const CREATED_DIRS: string[] = [];

const PASSING_TEST = `test "it loads" {
	then {
		expect true
	}
}
`;

afterEach(async () => {
	for (let dir of CREATED_DIRS.splice(0)) {
		await rm(dir, { recursive: true, force: true });
	}
});

async function makeSuiteDir(files: Record<string, string> = {}): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "spec-loader-"));
	CREATED_DIRS.push(root);
	for (let [relativePath, text] of Object.entries(files)) {
		let path = join(root, relativePath);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, text, "utf8");
	}
	return root;
}

describe("loadSuite", () => {
	test("finds .spec files recursively and orders them by relative path", async () => {
		let root = await makeSuiteDir({
			"b.spec": PASSING_TEST,
			"a.spec": PASSING_TEST,
			"nested/deeper/c.spec": PASSING_TEST,
		});

		let result = await loadSuite(root);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) throw new Error("expected a success");
		expect(result.data.files.map((file) => file.path)).toEqual([
			join(root, "a.spec"),
			join(root, "b.spec"),
			join(root, "nested/deeper/c.spec"),
		]);
	});

	test("ignores files without the .spec extension", async () => {
		let root = await makeSuiteDir({
			"a.spec": PASSING_TEST,
			"notes.txt": "not a spec { at all",
			"README.md": "# docs",
		});

		let result = await loadSuite(root);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) throw new Error("expected a success");
		expect(result.data.files).toHaveLength(1);
	});

	test("registers commands and fixtures suite-globally across files", async () => {
		let root = await makeSuiteDir({
			"commands/login.spec": `command login(name) {
	let user = name
}
`,
			"fixtures/admin.spec": `fixture admin {
	return "admin"
}
`,
			"a.spec": PASSING_TEST,
		});

		let result = await loadSuite(root);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) throw new Error("expected a success");
		let login = result.data.commands.get("login");
		expect(login?.kind).toBe("command");
		expect(login?.params).toEqual(["name"]);
		let admin = result.data.fixtures.get("admin");
		expect(admin?.kind).toBe("fixture");
		expect(result.data.commands.size).toBe(1);
		expect(result.data.fixtures.size).toBe(1);
	});

	test("fails with duplicate-definition naming both files for two commands", async () => {
		let root = await makeSuiteDir({
			"a.spec": `command login {
	return true
}
`,
			"b.spec": `command login {
	return false
}
`,
		});

		let result = await loadSuite(root);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(LoadError);
		expect(result.error.code).toBe("duplicate-definition");
		expect(result.error.message).toContain('"login"');
		expect(result.error.message).toContain(join(root, "a.spec"));
		expect(result.error.message).toContain(join(root, "b.spec"));
	});

	test("fails with duplicate-definition for two fixtures with one name", async () => {
		let root = await makeSuiteDir({
			"a.spec": `fixture user {
	return "one"
}
`,
			"b.spec": `fixture user {
	return "two"
}
`,
		});

		let result = await loadSuite(root);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.code).toBe("duplicate-definition");
		expect(result.error.message).toContain('"user"');
	});

	test("fails with duplicate-definition when a command and a fixture share a name", async () => {
		let root = await makeSuiteDir({
			"a.spec": `command user {
	return true
}
`,
			"b.spec": `fixture user {
	return "value"
}
`,
		});

		let result = await loadSuite(root);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.code).toBe("duplicate-definition");
		expect(result.error.message).toContain("command");
		expect(result.error.message).toContain("fixture");
	});

	test("fails with duplicate-definition inside a single file", async () => {
		let root = await makeSuiteDir({
			"a.spec": `command login {
	return true
}

command login {
	return false
}
`,
		});

		let result = await loadSuite(root);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.code).toBe("duplicate-definition");
	});

	test("aborts on the first parse error with the message prefixed by the path", async () => {
		let root = await makeSuiteDir({
			"broken.spec": `test "never closed" {
	then {
`,
		});

		let result = await loadSuite(root);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(ParseError);
		expect(result.error.code).toBe("parse-error");
		expect(result.error.message.startsWith(join(root, "broken.spec"))).toBe(true);
	});

	test("reports the lexicographically first failing file when several are broken", async () => {
		let root = await makeSuiteDir({
			"b.spec": `test "also broken" {
`,
			"a.spec": `test "broken first" {
`,
		});

		let result = await loadSuite(root);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error.message.startsWith(join(root, "a.spec"))).toBe(true);
	});

	test("fails with load-error when the root directory does not exist", async () => {
		let root = await makeSuiteDir();

		let result = await loadSuite(join(root, "missing"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(LoadError);
		expect(result.error.code).toBe("load-error");
	});

	test("fails with load-error when no .spec file exists under the root", async () => {
		let root = await makeSuiteDir({ "notes.txt": "nothing to run" });

		let result = await loadSuite(root);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected a failure");
		expect(result.error).toBeInstanceOf(LoadError);
		expect(result.error.code).toBe("load-error");
		expect(result.error.message).toContain(root);
	});
});
