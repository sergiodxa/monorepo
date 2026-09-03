/**
 * Parser tests: every GRAMMAR.md production and prose rule — phases and their
 * order, `eventually` placement, call expressions only as a full rhs, words
 * versus references, object literals and duplicate keys, spans — pinned with
 * the design suite's own examples among the cases.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { BlockNode, SpecFileNode, StatementNode } from "./ast";
import type { ParseError } from "./errors";

import { parse } from "./parser";
import { positionAt } from "./source";

function parseOk(text: string): SpecFileNode {
	let result = parse({ path: "test.spec", text });
	if (!isSuccess(result)) throw new Error(`expected parse to succeed: ${result.error.message}`);
	return result.data;
}

/** Parse text that must fail, returning the error for assertions. */
function parseError(text: string): ParseError {
	let result = parse({ path: "test.spec", text });
	if (!isFailure(result)) throw new Error(`expected parse to fail: ${text}`);
	return result.error;
}

/** The statements of a single-test file's phase, for compact assertions. */
function phaseOf(file: SpecFileNode, phase: "given" | "when" | "then"): BlockNode {
	let block = file.tests[0]?.[phase];
	if (!block) throw new Error(`expected the test to have a "${phase}" phase`);
	return block;
}

/** Wrap statements in a minimal test so they parse in a `given` block. */
function inGiven(statements: string): string {
	return `test "t" {\n\tgiven {\n${statements}\n\t}\n}\n`;
}

describe("parse: full examples from the design suite", () => {
	test("the ADR-006 ES-modules specification parses as written", () => {
		let file = parseOk(`use fs
use cli

test "supports ES modules" {
	given {
		write "package.json" {
			type: "module"
		}

		write "math.js" """
			export const add = (a, b) => a + b
		"""

		write "index.js" """
			import { add } from "./math.js"
			console.log(add(2, 3))
		"""
	}

	when {
		let result = cli.run "node" "index.js"
	}

	then {
		expect result.stdout "5\\n"
		expect result.exit_code 0
	}
}
`);
		expect(file.uses.map((use) => use.namespace)).toEqual(["fs", "cli"]);
		expect(file.tests).toHaveLength(1);
		expect(file.tests[0]?.title).toBe("supports ES modules");

		let given = phaseOf(file, "given");
		expect(given.statements).toHaveLength(3);
		let write = given.statements[0];
		if (write?.kind !== "call") throw new Error("expected a call statement");
		expect(write.target).toBe("write");
		let [path, content] = write.args;
		if (path?.kind !== "string") throw new Error("expected a string path argument");
		expect(path.value).toBe("package.json");
		if (content?.kind !== "object") throw new Error("expected an object argument");
		expect(content.entries).toHaveLength(1);
		expect(content.entries[0]?.key).toBe("type");
		let entryValue = content.entries[0]?.value;
		if (entryValue?.kind !== "string") throw new Error("expected a string entry value");
		expect(entryValue.value).toBe("module");

		let mathWrite = given.statements[1];
		if (mathWrite?.kind !== "call") throw new Error("expected a call statement");
		let mathContent = mathWrite.args[1];
		if (mathContent?.kind !== "string") throw new Error("expected a multiline string argument");
		expect(mathContent.value).toBe("export const add = (a, b) => a + b\n");

		let when = phaseOf(file, "when");
		let binding = when.statements[0];
		if (binding?.kind !== "let") throw new Error("expected a let statement");
		expect(binding.name).toBe("result");
		if (binding.value.kind !== "call-expr") throw new Error("expected a call expression rhs");
		expect(binding.value.target).toBe("cli.run");
		expect(binding.value.args).toHaveLength(2);

		let then = phaseOf(file, "then");
		expect(then.statements).toHaveLength(2);
		let firstExpect = then.statements[0];
		if (firstExpect?.kind !== "expect") throw new Error("expected an expect statement");
		let [subject, wanted] = firstExpect.args;
		if (subject?.kind !== "reference") throw new Error("expected a reference argument");
		expect(subject.path).toEqual(["result", "stdout"]);
		if (wanted?.kind !== "string") throw new Error("expected a string argument");
		expect(wanted.value).toBe("5\n");
	});

	test("the ADR-002 http.post object with a multiline body parses", () => {
		let file = parseOk(`test "posting" {
	then {
		let response = http.post "/posts" {
			title: "Spec-driven development"
			body: """
				A specification describes what the product does.
				An implementation describes one way to do it.
			"""
		}

		expect response.status 201
	}
}
`);
		let then = phaseOf(file, "then");
		expect(then.statements).toHaveLength(2);
		let binding = then.statements[0];
		if (binding?.kind !== "let") throw new Error("expected a let statement");
		if (binding.value.kind !== "call-expr") throw new Error("expected a call expression rhs");
		expect(binding.value.target).toBe("http.post");
		let body = binding.value.args[1];
		if (body?.kind !== "object") throw new Error("expected an object argument");
		expect(body.entries.map((entry) => entry.key)).toEqual(["title", "body"]);
		let multiline = body.entries[1]?.value;
		if (multiline?.kind !== "string") throw new Error("expected a string entry value");
		expect(multiline.value).toBe(
			"A specification describes what the product does.\nAn implementation describes one way to do it.\n",
		);
	});

	test("the ADR-002 fixture definition and fixture-call parse", () => {
		let file = parseOk(`fixture user {
	let response = http.post "/test/users" {
		email: "sergio@example.com"
	}

	return response.json
}

test "uses the fixture" {
	given {
		let user = fixture user
	}
}
`);
		let definition = file.definitions[0];
		if (definition?.kind !== "fixture") throw new Error("expected a fixture definition");
		expect(definition.name).toBe("user");
		expect(definition.body.statements).toHaveLength(2);
		let returned = definition.body.statements[1];
		if (returned?.kind !== "return") throw new Error("expected a return statement");
		if (returned.value.kind !== "reference") throw new Error("expected a reference rhs");
		expect(returned.value.path).toEqual(["response", "json"]);

		let binding = phaseOf(file, "given").statements[0];
		if (binding?.kind !== "let") throw new Error("expected a let statement");
		if (binding.value.kind !== "fixture-call") throw new Error("expected a fixture-call rhs");
		expect(binding.value.name).toBe("user");
	});
});

describe("parse: definitions", () => {
	test("a command without a parameter list has no params", () => {
		let file = parseOk('command logout { cli.run "logout" }\n');
		let definition = file.definitions[0];
		if (definition?.kind !== "command") throw new Error("expected a command definition");
		expect(definition.name).toBe("logout");
		expect(definition.params).toEqual([]);
		expect(definition.body.statements).toHaveLength(1);
	});

	test("a command lists its parameters in order", () => {
		let file = parseOk("command login(email, password) { return email }\n");
		let definition = file.definitions[0];
		if (definition?.kind !== "command") throw new Error("expected a command definition");
		expect(definition.params).toEqual(["email", "password"]);
	});

	test("newlines inside a parameter list are insignificant", () => {
		let file = parseOk("command login(\n\temail,\n\tpassword\n) { return email }\n");
		let definition = file.definitions[0];
		if (definition?.kind !== "command") throw new Error("expected a command definition");
		expect(definition.params).toEqual(["email", "password"]);
	});

	test("empty parens and an empty body are both valid", () => {
		let file = parseOk("command noop() {\n}\n");
		let definition = file.definitions[0];
		if (definition?.kind !== "command") throw new Error("expected a command definition");
		expect(definition.params).toEqual([]);
		expect(definition.body.statements).toEqual([]);
	});

	test("keywords are reserved as definition names", () => {
		expect(parseError("command test { }").message).toContain("reserved");
		expect(parseError("fixture given { }").message).toContain("reserved");
	});

	test("keywords are reserved as binding and namespace names", () => {
		expect(parseError(inGiven("\t\tlet let = 5")).message).toContain("reserved");
		expect(parseError("use test\n").message).toContain("reserved");
	});

	test("a namespace name cannot be dotted", () => {
		expect(parseError("use fs.extra\n").message).toContain("cannot contain dots");
	});
});

describe("parse: tests and phases", () => {
	test("a test may have a single phase", () => {
		let file = parseOk('test "t" { then { expect 1 } }\n');
		expect(file.tests[0]?.given).toBeUndefined();
		expect(file.tests[0]?.when).toBeUndefined();
		expect(file.tests[0]?.then).toBeDefined();
	});

	test("phases out of order name the rule", () => {
		let error = parseError('test "t" { when { logout } given { logout } }\n');
		expect(error.message).toContain("given, when, then order");
		expect(error.span).toBeDefined();
	});

	test("a repeated phase is rejected", () => {
		let error = parseError('test "t" { given { logout } given { logout } }\n');
		expect(error.message).toContain("more than once");
	});

	test("a test with no phase is rejected", () => {
		expect(parseError('test "t" { }\n').message).toContain("at least one phase");
	});

	test("only phase keywords may appear in a test body", () => {
		expect(parseError('test "t" { logout }\n').message).toContain('"given", "when", "then"');
	});

	test("a test needs a string title", () => {
		expect(parseError("test { then { logout } }\n").message).toContain("a test title string");
	});
});

describe("parse: eventually", () => {
	test("eventually with a within deadline parses inside then", () => {
		let file = parseOk('test "t" { then { eventually within 10s { expect 1 } } }\n');
		let statement = phaseOf(file, "then").statements[0];
		if (statement?.kind !== "eventually") throw new Error("expected an eventually statement");
		expect(statement.withinMs).toBe(10_000);
		expect(statement.block.statements).toHaveLength(1);
	});

	test("eventually without within leaves the deadline unset", () => {
		let file = parseOk('test "t" { then { eventually { expect 1 } } }\n');
		let statement = phaseOf(file, "then").statements[0];
		if (statement?.kind !== "eventually") throw new Error("expected an eventually statement");
		expect(statement.withinMs).toBeUndefined();
	});

	test("eventually is rejected outside then blocks", () => {
		expect(parseError('test "t" { given { eventually { expect 1 } } }\n').message).toContain(
			'only valid directly inside a "then" block',
		);
		expect(parseError("command c { eventually { expect 1 } }\n").message).toContain(
			'only valid directly inside a "then" block',
		);
		expect(
			parseError('test "t" { then { eventually { eventually { expect 1 } } } }\n').message,
		).toContain('only valid directly inside a "then" block');
	});

	test("within requires a duration literal", () => {
		expect(
			parseError('test "t" { then { eventually within 5 { expect 1 } } }\n').message,
		).toContain("a duration");
	});
});

describe("parse: let, return, and right-hand sides", () => {
	test("every rhs form builds its node", () => {
		let file = parseOk(
			inGiven(
				[
					'\t\tlet s = "text"',
					"\t\tlet n = -42",
					"\t\tlet b = true",
					"\t\tlet d = 10s",
					"\t\tlet o = { a: 1 }",
					"\t\tlet r = user.email",
					'\t\tlet c = run "node"',
				].join("\n"),
			),
		);
		let statements = phaseOf(file, "given").statements;
		let values = statements.map((statement: StatementNode) => {
			if (statement.kind !== "let") throw new Error("expected only let statements");
			return statement.value;
		});
		expect(values.map((value) => value.kind)).toEqual([
			"string",
			"number",
			"boolean",
			"duration",
			"object",
			"reference",
			"call-expr",
		]);
		let [text, negative, boolean, duration, , reference] = values;
		if (text?.kind !== "string") throw new Error("expected a string");
		expect(text.value).toBe("text");
		if (negative?.kind !== "number") throw new Error("expected a number");
		expect(negative.value).toBe(-42);
		if (boolean?.kind !== "boolean") throw new Error("expected a boolean");
		expect(boolean.value).toBe(true);
		if (duration?.kind !== "duration") throw new Error("expected a duration");
		expect(duration.milliseconds).toBe(10_000);
		if (reference?.kind !== "reference") throw new Error("expected a reference");
		expect(reference.path).toEqual(["user", "email"]);
	});

	test("a call expression is only valid as the entire rhs", () => {
		expect(parseError(inGiven("\t\tlet x = run (logout)")).message).toContain(
			"a newline to end the statement",
		);
	});
});

describe("parse: calls, words, and references", () => {
	test("a bare call statement may have zero arguments", () => {
		let file = parseOk('test "t" { when { logout } }\n');
		let statement = phaseOf(file, "when").statements[0];
		if (statement?.kind !== "call") throw new Error("expected a call statement");
		expect(statement.target).toBe("logout");
		expect(statement.args).toEqual([]);
	});

	test("bare identifiers are words, dotted paths are references", () => {
		let file = parseOk('test "t" { when { fill textbox "Email" with user.email } }\n');
		let statement = phaseOf(file, "when").statements[0];
		if (statement?.kind !== "call") throw new Error("expected a call statement");
		expect(statement.target).toBe("fill");
		expect(statement.args.map((argument) => argument.kind)).toEqual([
			"word",
			"string",
			"word",
			"reference",
		]);
		let [first, , third, fourth] = statement.args;
		if (first?.kind !== "word") throw new Error("expected a word");
		expect(first.word).toBe("textbox");
		if (third?.kind !== "word") throw new Error("expected a word");
		expect(third.word).toBe("with");
		if (fourth?.kind !== "reference") throw new Error("expected a reference");
		expect(fourth.path).toEqual(["user", "email"]);
	});

	test("two statements on one line are rejected", () => {
		expect(parseError(inGiven("\t\tlet x = 5 let y = 6")).message).toContain(
			"a newline to end the statement",
		);
	});

	test("the fixture keyword is not a statement", () => {
		expect(parseError(inGiven("\t\tfixture user")).message).toContain("a statement");
	});
});

describe("parse: expect", () => {
	test("the observable form keeps words as words", () => {
		let file = parseOk('test "t" { then { expect file "dist/index.js" exists } }\n');
		let statement = phaseOf(file, "then").statements[0];
		if (statement?.kind !== "expect") throw new Error("expected an expect statement");
		expect(statement.args.map((argument) => argument.kind)).toEqual(["word", "string", "word"]);
	});

	test("literals and booleans are expressions in argument position", () => {
		let file = parseOk('test "t" { then { expect ok true } }\n');
		let statement = phaseOf(file, "then").statements[0];
		if (statement?.kind !== "expect") throw new Error("expected an expect statement");
		expect(statement.args.map((argument) => argument.kind)).toEqual(["word", "boolean"]);
	});

	test("expect requires at least one argument", () => {
		expect(parseError('test "t" { then { expect } }\n').message).toContain(
			'at least one argument to "expect"',
		);
	});
});

describe("parse: object literals", () => {
	test("comma and newline separators are interchangeable", () => {
		let inline = parseOk(inGiven("\t\tlet o = { a: 1, b: 2 }"));
		let multiline = parseOk(inGiven("\t\tlet o = {\n\t\t\ta: 1\n\t\t\tb: 2\n\t\t}"));
		for (let file of [inline, multiline]) {
			let statement = phaseOf(file, "given").statements[0];
			if (statement?.kind !== "let") throw new Error("expected a let statement");
			if (statement.value.kind !== "object") throw new Error("expected an object rhs");
			expect(statement.value.entries.map((entry) => entry.key)).toEqual(["a", "b"]);
		}
	});

	test("objects nest and accept string keys", () => {
		let file = parseOk(inGiven('\t\tlet o = { "content-type": "json", nested: { b: 2 } }'));
		let statement = phaseOf(file, "given").statements[0];
		if (statement?.kind !== "let") throw new Error("expected a let statement");
		if (statement.value.kind !== "object") throw new Error("expected an object rhs");
		expect(statement.value.entries[0]?.key).toBe("content-type");
		let nested = statement.value.entries[1]?.value;
		if (nested?.kind !== "object") throw new Error("expected a nested object");
		expect(nested.entries[0]?.key).toBe("b");
	});

	test("an empty object literal parses", () => {
		let file = parseOk(inGiven("\t\tlet o = {}"));
		let statement = phaseOf(file, "given").statements[0];
		if (statement?.kind !== "let") throw new Error("expected a let statement");
		if (statement.value.kind !== "object") throw new Error("expected an object rhs");
		expect(statement.value.entries).toEqual([]);
	});

	test("duplicate keys are a parse error", () => {
		expect(parseError(inGiven("\t\tlet o = { a: 1, a: 2 }")).message).toContain(
			'Duplicate key "a"',
		);
	});

	test("a trailing comma is rejected", () => {
		expect(parseError(inGiven("\t\tlet o = { a: 1, }")).message).toContain(
			'an object key after ","',
		);
	});

	test("a key needs its colon", () => {
		expect(parseError(inGiven("\t\tlet o = { a 1 }")).message).toContain(
			'":" after the object key',
		);
	});

	test("keywords cannot be unquoted keys", () => {
		expect(parseError(inGiven("\t\tlet o = { true: 1 }")).message).toContain("reserved");
	});
});

describe("parse: files, comments, and diagnostics", () => {
	test("comments never affect the tree", () => {
		let file = parseOk(`# suite comment
use fs # import

test "t" { # open
	given {
		# setup
		write "a" "b" # write
	}
}
`);
		expect(file.uses).toHaveLength(1);
		expect(file.tests).toHaveLength(1);
		expect(phaseOf(file, "given").statements).toHaveLength(1);
	});

	test("only use, definitions, and tests may appear at the top level", () => {
		expect(parseError("foo bar\n").message).toContain('"use", "command", "fixture", or "test"');
	});

	test("top-level items end at a newline", () => {
		let error = parseError('test "a" { then { logout } } test "b" { then { logout } }\n');
		expect(error.message).toContain("a newline after the declaration");
	});

	test("lexer failures propagate through parse", () => {
		let error = parseError('test "unterminated');
		expect(error.message).toContain("Unterminated string");
		expect(error.code).toBe("parse-error");
	});

	test("errors carry the file path and a span", () => {
		let error = parseError('test "t" { }\n');
		expect(error.file).toBe("test.spec");
		expect(error.span).toBeDefined();
	});

	test("nodes carry real spans that map to lines and columns", () => {
		let text = 'test "a" {\n\tthen {\n\t\texpect 1\n\t}\n}\n';
		let file = parseOk(text);
		let testNode = file.tests[0];
		if (!testNode) throw new Error("expected one test");
		expect(testNode.span.start).toBe(0);
		expect(testNode.span.end).toBe(text.lastIndexOf("}") + 1);
		let statement = phaseOf(file, "then").statements[0];
		if (statement?.kind !== "expect") throw new Error("expected an expect statement");
		expect(statement.span.start).toBe(text.indexOf("expect"));
		expect(positionAt({ path: "test.spec", text }, statement.span.start)).toEqual({
			line: 3,
			column: 3,
		});
	});
});
