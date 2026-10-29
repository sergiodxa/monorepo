/**
 * The kit schema renderer and its drift check: configuration and lock JSON Schema stay in
 * lockstep with the command line's validators, and a missing or stale committed file fails CI.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { GENERATE_COMMAND, generateKitSchemas, kitSchemaDrift } from "./kit-schemas.js";

/** Repo root, resolved from this file so the check targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "../..");

describe("generateKitSchemas", () => {
	test("renders the configuration schema as JSON Schema 2020-12", () => {
		let schema = JSON.parse(unwrap(generateKitSchemas()).get("config.schema.json") ?? "");

		expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
		expect(schema.properties.lock.default).toBe(".config/sdxc.lock.jsonl");
	});

	test("renders the lock file's entry schema as JSON Schema 2020-12", () => {
		let schema = JSON.parse(unwrap(generateKitSchemas()).get("lock.schema.json") ?? "");

		expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
		expect(schema.required).toEqual(["kind", "name"]);
	});
});

test("the committed kit schemas match what generateKitSchemas produces", async () => {
	let problems = unwrap(await kitSchemaDrift(ROOT));

	expect(problems, `run \`${GENERATE_COMMAND}\` and commit the result`).toEqual([]);
});
