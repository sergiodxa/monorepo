/**
 * Tests for the built-in `sample` plugin: that every tool draws from the stream
 * on its context and so replays with it, that the tools are actions rather than
 * observations, and that a bad argument comes back as a tool error instead of
 * an exception escaping the plugin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success, unwrap } from "@sdxc/result";
import { createRandom } from "@sdxc/sample";
import { describe, expect, test } from "vitest";

import type { SpecError } from "../errors.js";
import type { PermissionSet } from "../permissions.js";
import type { ToolContext } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";
import type { Workspace } from "../workspace.js";

import { createSamplePlugin } from "./sample.js";

const PLUGIN = createSamplePlugin();

const NOW = new Date("2026-06-15T12:00:00.000Z");

function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** A permission set that grants nothing; the sample plugin never asks it anything. */
function grantNothing(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

/** A workspace stub; sample tools never touch the filesystem. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-sample-tests",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

function buildContext(seed = "test"): ToolContext {
	return {
		workspace: stubWorkspace(),
		permissions: grantNothing(),
		random: createRandom(seed),
		now: NOW,
	};
}

function expectSuccess(result: Result<Value, SpecError>): Value {
	if (isFailure(result)) throw new Error(`expected success, got ${result.error.message}`);
	return unwrap(result);
}

function expectFailure(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	return result.error;
}

function asString(data: Value | undefined): string {
	if (typeof data !== "string") throw new Error(`expected a string, got ${JSON.stringify(data)}`);
	return data;
}

function asObject(data: Value): ValueObject {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`expected an object value, got ${JSON.stringify(data)}`);
	}
	return data;
}

describe("the plugin's shape", () => {
	test("declares every tool as an action needing no permission", () => {
		for (let descriptor of PLUGIN.describe()) {
			expect(descriptor.kind).toBe("action");
			expect(descriptor.requires).toBeUndefined();
		}
	});

	test("exposes one tool per module, and one per generator that takes an argument", () => {
		expect(PLUGIN.describe().map((descriptor) => descriptor.name)).toEqual([
			"person",
			"internet",
			"location",
			"company",
			"lorem",
			"date",
			"string",
			"number",
			"color",
			"datatype",
			"git",
			"hacker",
			"phone",
			"system",
			"email",
			"uuid",
			"int",
			"float",
			"words",
			"pick",
		]);
	});

	test("names the tools it has when asked for one it does not", async () => {
		let error = expectFailure(await PLUGIN.call("nickname", [], buildContext()));

		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('sample has no tool "nickname"');
		expect(error.message).toContain("person, internet, location");
		expect(error.message).toContain("int, float, words, pick");
	});
});

describe("person", () => {
	test("returns a person whose fields agree, in the suite's key style", async () => {
		let person = asObject(expectSuccess(await PLUGIN.call("person", [], buildContext())));

		expect(Object.keys(person)).toContain("first_name");
		expect(Object.keys(person)).toContain("job_title");
		expect(Object.keys(person)).toContain("zodiac_sign");
		expect(asString(person.full_name)).toBe(
			`${asString(person.first_name)} ${asString(person.last_name)}`,
		);
		expect(asString(person.email).startsWith(asString(person.username))).toBe(true);
	});

	test("replays from the context's stream", async () => {
		let first = expectSuccess(await PLUGIN.call("person", [], buildContext("run")));
		let second = expectSuccess(await PLUGIN.call("person", [], buildContext("run")));

		expect(first).toEqual(second);
	});

	test("gives different streams different people", async () => {
		let first = expectSuccess(await PLUGIN.call("person", [], buildContext("one")));
		let second = expectSuccess(await PLUGIN.call("person", [], buildContext("two")));

		expect(first).not.toEqual(second);
	});

	test("advances the stream, so a second call differs", async () => {
		let context = buildContext();
		let first = expectSuccess(await PLUGIN.call("person", [], context));
		let second = expectSuccess(await PLUGIN.call("person", [], context));

		expect(first).not.toEqual(second);
	});
});

describe("email and uuid", () => {
	test("puts an address on a domain reserved for documentation", async () => {
		let context = buildContext();

		for (let count = 0; count < 50; count++) {
			let email = expectSuccess(await PLUGIN.call("email", [], context));
			expect(asString(email)).toMatch(/@example\.(com|org|net)$/);
		}
	});

	test("shapes an identifier as a version 4 UUID", async () => {
		let context = buildContext();
		let uuid = expectSuccess(await PLUGIN.call("uuid", [], context));

		expect(asString(uuid)).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});
});

describe("int", () => {
	test("stays between the bounds it is given", async () => {
		let context = buildContext();

		for (let count = 0; count < 100; count++) {
			let drawn = expectSuccess(await PLUGIN.call("int", [value(1), value(6)], context));
			expect(drawn).toBeGreaterThanOrEqual(1);
			expect(drawn).toBeLessThanOrEqual(6);
		}
	});

	test("refuses a missing bound", async () => {
		let error = expectFailure(await PLUGIN.call("int", [value(1)], buildContext()));

		expect(error.message).toContain('sample.int needs a number for "max"');
	});

	test("refuses a bound that is not a number", async () => {
		let error = expectFailure(await PLUGIN.call("int", [value("one"), value(6)], buildContext()));

		expect(error.message).toContain('sample.int needs a number for "min"');
	});

	test("reports a range it cannot honor as a tool error", async () => {
		let error = expectFailure(await PLUGIN.call("int", [value(10), value(1)], buildContext()));

		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("sample.int could not generate a value");
	});
});

describe("words", () => {
	test("returns the count asked for", async () => {
		let drawn = expectSuccess(await PLUGIN.call("words", [value(5)], buildContext()));

		expect(asString(drawn).split(" ")).toHaveLength(5);
	});

	test("refuses a count that is not a number", async () => {
		let error = expectFailure(await PLUGIN.call("words", [value("five")], buildContext()));

		expect(error.message).toContain('sample.words needs a number for "count"');
	});

	test("reports a nonsensical count as a tool error", async () => {
		let error = expectFailure(await PLUGIN.call("words", [value(-3)], buildContext()));

		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("sample.words could not generate a value");
	});
});

describe("pick", () => {
	test("returns an element of the list", async () => {
		let context = buildContext();
		let plans = ["free", "pro", "team"];

		for (let count = 0; count < 50; count++) {
			let drawn = expectSuccess(await PLUGIN.call("pick", [value(plans)], context));
			expect(plans).toContain(drawn);
		}
	});

	test("reaches every element of the list", async () => {
		let context = buildContext();
		let seen = new Set<Value>();

		for (let count = 0; count < 100; count++) {
			seen.add(expectSuccess(await PLUGIN.call("pick", [value(["a", "b", "c"])], context)));
		}

		expect([...seen].map(asString).sort()).toEqual(["a", "b", "c"]);
	});

	test("refuses a value that is not a list", async () => {
		let error = expectFailure(await PLUGIN.call("pick", [value("free")], buildContext()));

		expect(error.message).toContain("sample.pick needs a list to pick from");
	});

	test("refuses an empty list", async () => {
		let error = expectFailure(await PLUGIN.call("pick", [value([])], buildContext()));

		expect(error.message).toContain("sample.pick needs a list with at least one item");
	});
});

describe("one tool per module", () => {
	/** Every field a module record carries, for a spec to read by path. */
	async function fields(tool: string): Promise<ValueObject> {
		return asObject(expectSuccess(await PLUGIN.call(tool, [], buildContext())));
	}

	test("gives each module a record whose fields are named in snake case", async () => {
		for (let tool of [
			"person",
			"internet",
			"location",
			"company",
			"lorem",
			"date",
			"string",
			"number",
			"color",
			"datatype",
			"git",
			"hacker",
			"phone",
			"system",
		]) {
			let record = await fields(tool);

			expect(Object.keys(record).length).toBeGreaterThan(0);
			for (let key of Object.keys(record)) expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
		}
	});

	test("puts a whole address on the location record, with a city in its country", async () => {
		let location = await fields("location");

		expect(asString(location.zip_code)).toMatch(/^\d{5}$/);
		expect(asString(location.street_address)).toMatch(/^\d{1,4} /);
		expect(asString(location.postal_address)).toContain(asString(location.country));
	});

	test("writes dates as ISO timestamps a spec can compare", async () => {
		let dates = await fields("date");

		for (let key of ["past", "future", "recent", "soon", "anytime", "birthdate"]) {
			expect(asString(dates[key])).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		}
	});

	test("keeps the internet record's contact details unroutable", async () => {
		let internet = await fields("internet");

		expect(asString(internet.email)).toMatch(/@example\.(com|org|net)$/);
		expect(asString(internet.url)).toMatch(/^https:\/\/[a-z0-9]+\.example\.(com|org|net)/);
	});

	test("returns numbers and booleans as themselves, not as text", async () => {
		let numbers = await fields("number");
		let datatype = await fields("datatype");

		expect(typeof numbers.int).toBe("number");
		expect(typeof numbers.float).toBe("number");
		expect(typeof datatype.boolean).toBe("boolean");
	});

	test("replays every module record from the seed", async () => {
		for (let tool of ["person", "location", "git", "system"]) {
			let first = expectSuccess(await PLUGIN.call(tool, [], buildContext("run")));
			let second = expectSuccess(await PLUGIN.call(tool, [], buildContext("run")));

			expect(first).toEqual(second);
		}
	});
});

describe("float", () => {
	test("stays between the bounds it is given", async () => {
		let context = buildContext();

		for (let count = 0; count < 50; count++) {
			let drawn = expectSuccess(await PLUGIN.call("float", [value(0), value(10)], context));
			expect(drawn).toBeGreaterThanOrEqual(0);
			expect(drawn).toBeLessThanOrEqual(10);
		}
	});

	test("refuses a bound that is not a number", async () => {
		let error = expectFailure(await PLUGIN.call("float", [value("low"), value(1)], buildContext()));

		expect(error.message).toContain('sample.float needs a number for "min"');
	});
});
