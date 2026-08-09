import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Sink, SuiteResult, TestResult } from "./diagnostics";
import type { SourceFile } from "./source";

import {
	ExpectationError,
	LoadError,
	ParseError,
	PermissionDeniedError,
	SpecError,
	ToolError,
	WorkspaceEscapeError,
} from "./errors";
import { reportFatal, reportSuite } from "./reporter";

class BufferSink implements Sink {
	text = "";

	write(text: string): void {
		this.text += text;
	}
}

function passed(title: string, durationMs: number): TestResult {
	return { title, file: "spec/example.spec", status: "passed", durationMs };
}

function failed(title: string, file: string, error: SpecError, durationMs: number): TestResult {
	return { title, file, status: "failed", error, durationMs };
}

describe(reportSuite, () => {
	test("reports an all-passing suite with counts and duration", () => {
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [passed("writes a file", 12), passed("reads it back", 8)],
			passed: 2,
			failed: 0,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe("✓ writes a file\n✓ reads it back\n\n2 passed, 0 failed (20ms)\n");
	});

	test("reports an empty suite as a lone summary line", () => {
		let sink = new BufferSink();
		let suite: SuiteResult = { results: [], passed: 0, failed: 0 };

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe("0 passed, 0 failed (0ms)\n");
	});

	test("reports a value-mode failure with expected and observed", () => {
		let source: SourceFile = {
			path: "spec/http.spec",
			text: 'test "posts json" {\n\tthen {\n\t\texpect status 200\n\t}\n}\n',
		};
		let offset = source.text.indexOf("expect");
		let error = new ExpectationError("values are not equal", 200, 404);
		error.file = source.path;
		error.span = { start: offset, end: offset + "expect".length };
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [failed("posts json", source.path, error, 57)],
			passed: 0,
			failed: 1,
		};

		reportSuite(suite, new Map([[source.path, source]]), sink);

		expect(sink.text).toBe(
			[
				"✗ posts json (spec/http.spec:3)",
				"  expectation-failed: values are not equal",
				"  expected: 200",
				"  observed: 404",
				"",
				"0 passed, 1 failed (57ms)",
				"",
			].join("\n"),
		);
	});

	test("indents every line of a multi-line expected value", () => {
		let error = new ExpectationError(
			"values are not equal",
			{ name: "a".repeat(60), role: "admin" },
			"nope",
		);
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [failed("compares objects", "spec/values.spec", error, 3)],
			passed: 0,
			failed: 1,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ compares objects (spec/values.spec)",
				"  expectation-failed: values are not equal",
				"  expected: {",
				`    "name": "${"a".repeat(60)}",`,
				'    "role": "admin"',
				"  }",
				'  observed: "nope"',
				"",
				"0 passed, 1 failed (3ms)",
				"",
			].join("\n"),
		);
	});

	test("groups a lone permission denial into a one-test block", () => {
		let error = new PermissionDeniedError("run", "node", "spec run --allow-run=node");
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [failed("runs node", "spec/cli.spec", error, 5)],
			passed: 0,
			failed: 1,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ Permission denied: run (1 test)",
				"",
				"  The spec attempted to reach:",
				"  > node",
				"",
				"  Re-run with an appropriate permission, for example:",
				"  > spec run --allow-run=node",
				"",
				"  Affected tests:",
				"  - runs node (spec/cli.spec)",
				"",
				"0 passed, 1 failed (5ms)",
				"",
			].join("\n"),
		);
	});

	test("collapses denials sharing a remedy into one block listing every test", () => {
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [
				failed(
					"runs echo",
					"spec/a.spec",
					new PermissionDeniedError("run", "cli.run", "spec run --allow-run"),
					2,
				),
				failed(
					"runs ls",
					"spec/b.spec",
					new PermissionDeniedError("run", "cli.run", "spec run --allow-run"),
					3,
				),
				failed(
					"runs cat",
					"spec/c.spec",
					new PermissionDeniedError("run", "cli.run", "spec run --allow-run"),
					4,
				),
			],
			passed: 0,
			failed: 3,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ Permission denied: run (3 tests)",
				"",
				"  The spec attempted to reach:",
				"  > cli.run",
				"",
				"  Re-run with an appropriate permission, for example:",
				"  > spec run --allow-run",
				"",
				"  Affected tests:",
				"  - runs echo (spec/a.spec)",
				"  - runs ls (spec/b.spec)",
				"  - runs cat (spec/c.spec)",
				"",
				"0 passed, 3 failed (9ms)",
				"",
			].join("\n"),
		);
	});

	test("separates denials with distinct remedies into their own blocks", () => {
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [
				failed(
					"spawns a tool",
					"spec/a.spec",
					new PermissionDeniedError("run", "cli.run", "spec run --allow-run"),
					2,
				),
				failed(
					"calls the api",
					"spec/b.spec",
					new PermissionDeniedError(
						"net",
						"api.example.com",
						"spec run --allow-net=api.example.com",
					),
					3,
				),
			],
			passed: 0,
			failed: 2,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ Permission denied: run (1 test)",
				"",
				"  The spec attempted to reach:",
				"  > cli.run",
				"",
				"  Re-run with an appropriate permission, for example:",
				"  > spec run --allow-run",
				"",
				"  Affected tests:",
				"  - spawns a tool (spec/a.spec)",
				"",
				"✗ Permission denied: net (1 test)",
				"",
				"  The spec attempted to reach:",
				"  > api.example.com",
				"",
				"  Re-run with an appropriate permission, for example:",
				"  > spec run --allow-net=api.example.com",
				"",
				"  Affected tests:",
				"  - calls the api (spec/b.spec)",
				"",
				"0 passed, 2 failed (5ms)",
				"",
			].join("\n"),
		);
	});

	test("prints inline failures and passes before the accumulated denial block", () => {
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [
				failed(
					"the ledger balances",
					"spec/ledger.spec",
					new ExpectationError("values are not equal", 1, 2),
					4,
				),
				failed(
					"runs echo",
					"spec/a.spec",
					new PermissionDeniedError("run", "cli.run", "spec run --allow-run"),
					2,
				),
				passed("adds up", 1),
				failed(
					"runs ls",
					"spec/b.spec",
					new PermissionDeniedError("run", "cli.run", "spec run --allow-run"),
					3,
				),
			],
			passed: 1,
			failed: 3,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ the ledger balances (spec/ledger.spec)",
				"  expectation-failed: values are not equal",
				"  expected: 1",
				"  observed: 2",
				"",
				"✓ adds up",
				"",
				"✗ Permission denied: run (2 tests)",
				"",
				"  The spec attempted to reach:",
				"  > cli.run",
				"",
				"  Re-run with an appropriate permission, for example:",
				"  > spec run --allow-run",
				"",
				"  Affected tests:",
				"  - runs echo (spec/a.spec)",
				"  - runs ls (spec/b.spec)",
				"",
				"1 passed, 3 failed (10ms)",
				"",
			].join("\n"),
		);
	});

	test("does not group a permission denial that lost its remedy", () => {
		let error = new SpecError("permission-denied", "Permission denied: net");
		let denial = error as SpecError & { permission?: string; resource?: string };
		denial.permission = "net";
		denial.resource = "api.example.com";
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [failed("fetches", "spec/http.spec", error, 2)],
			passed: 0,
			failed: 1,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ fetches (spec/http.spec)",
				"  permission-denied: Permission denied: net",
				"",
				"0 passed, 1 failed (2ms)",
				"",
			].join("\n"),
		);
	});

	test("falls back to code and message when a denial lost its fields", () => {
		let error = new SpecError("permission-denied", "Permission denied: net");
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [failed("fetches", "spec/http.spec", error, 2)],
			passed: 0,
			failed: 1,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ fetches (spec/http.spec)",
				"  permission-denied: Permission denied: net",
				"",
				"0 passed, 1 failed (2ms)",
				"",
			].join("\n"),
		);
	});

	test("includes the remedy line for errors that carry one", () => {
		let error = new WorkspaceEscapeError("../outside.txt");
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [failed("escapes", "spec/fs.spec", error, 1)],
			passed: 0,
			failed: 1,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ escapes (spec/fs.spec)",
				"  workspace-escape: Path resolves outside the test workspace: ../outside.txt",
				"  remedy: spec run --allow-host-fs=<directory>",
				"",
				"0 passed, 1 failed (1ms)",
				"",
			].join("\n"),
		);
	});

	test("keeps a failure between passing tests separated and counted", () => {
		let error = new ToolError("boom");
		let sink = new BufferSink();
		let suite: SuiteResult = {
			results: [failed("first", "spec/a.spec", error, 2), passed("second", 1)],
			passed: 1,
			failed: 1,
		};

		reportSuite(suite, new Map<string, SourceFile>(), sink);

		expect(sink.text).toBe(
			[
				"✗ first (spec/a.spec)",
				"  tool-error: boom",
				"",
				"✓ second",
				"",
				"1 passed, 1 failed (3ms)",
				"",
			].join("\n"),
		);
	});
});

describe(reportFatal, () => {
	test("reports a parse error with file, line, and column", async () => {
		let directory = await mkdtemp(join(tmpdir(), "spec-reporter-"));
		try {
			let file = join(directory, "broken.spec");
			let text = 'test "x" {\n\tthen {\n';
			await writeFile(file, text);
			let error = new ParseError('expected "}" but found end of file', file, {
				start: text.length,
				end: text.length,
			});
			let sink = new BufferSink();

			reportFatal(error, sink);

			expect(sink.text).toBe(`✗ parse-error: expected "}" but found end of file (${file}:3:1)\n`);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test("reports a load error with no file as code and message alone", () => {
		let error = new LoadError("load-error", "no .spec files under ./spec");
		let sink = new BufferSink();

		reportFatal(error, sink);

		expect(sink.text).toBe("✗ load-error: no .spec files under ./spec\n");
	});

	test("falls back to the bare path when the file cannot be re-read", () => {
		let error = new ParseError("unexpected token", "/definitely/missing/file.spec", {
			start: 4,
			end: 5,
		});
		let sink = new BufferSink();

		reportFatal(error, sink);

		expect(sink.text).toBe("✗ parse-error: unexpected token (/definitely/missing/file.spec)\n");
	});

	test("appends the remedy line when the error carries one", () => {
		let error = new WorkspaceEscapeError("/etc/passwd");
		let sink = new BufferSink();

		reportFatal(error, sink);

		expect(sink.text).toBe(
			[
				"✗ workspace-escape: Path resolves outside the test workspace: /etc/passwd",
				"  remedy: spec run --allow-host-fs=<directory>",
				"",
			].join("\n"),
		);
	});
});
