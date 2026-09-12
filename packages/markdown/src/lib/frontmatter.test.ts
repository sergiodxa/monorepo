/**
 * Covers the four cases the frontmatter half has — block present or absent,
 * schema present or absent — plus the loud failure a block YAML rejects now
 * produces, which the reading path used to swallow as an empty object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { MarkdownParseError } from "./errors.js";
import { readFrontmatterBlock, validateFrontmatter } from "./frontmatter.js";

const SCHEMA = s.object({ title: s.string() });

describe("readFrontmatterBlock", () => {
	test("reads the block and points at the body after it", () => {
		let block = unwrap(readFrontmatterBlock("---\ntitle: Hi\n---\n# Body\n"));

		expect(block.value).toEqual({ title: "Hi" });
		expect(block.bodyStart).toEqual({ line: 4, column: 1, offset: 18 });
	});

	test("treats a file with no block as an empty one, so a schema still runs", () => {
		let block = unwrap(readFrontmatterBlock("# Body\n"));

		expect(block.value).toEqual({});
		expect(block.bodyStart).toEqual({ line: 1, column: 1, offset: 0 });
	});

	test("leaves an unclosed opening delimiter to the body, where it is a thematic break", () => {
		let block = unwrap(readFrontmatterBlock("---\ntitle: Hi\n"));

		expect(block.value).toEqual({});
		expect(block.bodyStart.line).toBe(1);
	});

	test("leaves a delimited block holding a scalar to the body", () => {
		let block = unwrap(readFrontmatterBlock("---\nFoo\n---\nBar\n"));

		expect(block.value).toEqual({});
		expect(block.bodyStart.line).toBe(1);
	});

	test("leaves an empty delimited block to the body, where it is two thematic breaks", () => {
		let block = unwrap(readFrontmatterBlock("---\n---\n"));

		expect(block.bodyStart.line).toBe(1);
	});

	test("fails with the line a block YAML cannot read", () => {
		let result = readFrontmatterBlock("---\ntitle: Hi\n\tbroken: true\n---\n");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error).toBeInstanceOf(MarkdownParseError);
		expect(result.error.position?.start.line).toBe(3);
		expect(result.error.cause).toBeDefined();
	});
});

describe("validateFrontmatter", () => {
	let position = {
		start: { line: 1, column: 1, offset: 0 },
		end: { line: 3, column: 4, offset: 16 },
	};

	test("passes the value through untouched when no schema is given", () => {
		let result = validateFrontmatter({ title: 42 }, position);

		expect(isSuccess(result)).toBe(true);
		expect(unwrap(result)).toEqual({ title: 42 });
	});

	test("returns the schema's output when it validates", () => {
		expect(unwrap(validateFrontmatter({ title: "Hi" }, position, SCHEMA))).toEqual({ title: "Hi" });
	});

	test("carries the schema's issues and the block's position when it fails", () => {
		let result = validateFrontmatter({}, position, SCHEMA);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		expect(result.error.issues.length).toBeGreaterThan(0);
		expect(result.error.position).toEqual(position);
	});
});
