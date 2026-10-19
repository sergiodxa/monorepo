/**
 * The `ui` check over a fixture kit and project: copies current with the registry pass, a copy a
 * later release changed warns with the update command, an edited copy is listed either way, and
 * a project with no copies skips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import type { RegistryEntry } from "../ui/registry.js";

import { hashContent } from "../ui/commands.js";
import { REGISTRY_DIR } from "../ui/registry.js";

import { fixture, removeFixtures, writeTree } from "./fixture.js";
import { uiCheck } from "./ui.js";

afterEach(removeFixtures);

/** A component's source as every release ships it. */
const SOURCE = "export function Button() {}\n";

/** The registry entry for `name`, last changed in `changedIn`. */
function entry(name: string, changedIn: string): RegistryEntry {
	return {
		name,
		changedIn,
		dependencies: [],
		exports: [],
		source: { path: `${name}.tsx`, content: SOURCE },
		test: null,
	};
}

/** An `@sdxc/kit` package at release 2026.10.14 whose registry holds `entries`. */
async function kit(entries: RegistryEntry[]): Promise<string> {
	let files: Record<string, string> = {
		"package.json": JSON.stringify({ name: "@sdxc/kit", version: "2026.10.14" }),
	};
	for (let item of entries) files[`${REGISTRY_DIR}/${item.name}.json`] = JSON.stringify(item);
	return writeTree(files);
}

/** A project holding a copy of each of `copies`, from its release, with the given content. */
async function project(
	packageRoot: string,
	copies: Array<{ name: string; release: string; content: string }>,
) {
	let files: Record<string, string> = { "tsconfig.json": "{}" };
	let lock: string[] = [];
	for (let copy of copies) {
		files[`resources/components/ui/${copy.name}.tsx`] = copy.content;
		lock.push(
			JSON.stringify({
				kind: "ui",
				name: copy.name,
				release: copy.release,
				files: { [`${copy.name}.tsx`]: hashContent(SOURCE) },
			}),
		);
	}
	if (lock.length > 0) files[".config/sdxc.lock.jsonl"] = `${lock.join("\n")}\n`;
	return fixture(files, { packageRoot });
}

describe("uiCheck", () => {
	test("passes copies current with the registry and lists an edited one", async () => {
		let packageRoot = await kit([entry("button", "2026.9.1"), entry("dialog", "2026.9.1")]);
		let context = await project(packageRoot, [
			{ name: "button", release: "2026.10.1", content: SOURCE },
			{ name: "dialog", release: "2026.10.1", content: "export function Dialog() {}\n" },
		]);

		expect(await uiCheck.run(context)).toEqual({
			status: "pass",
			message: "2 copied components are current with release 2026.10.14",
			findings: ["dialog is edited; sdxc ui diff dialog shows how"],
			fix: null,
		});
	});

	test("warns on a copy a later release changed, with the update command", async () => {
		let packageRoot = await kit([entry("button", "2026.10.14"), entry("dialog", "2026.9.1")]);
		let context = await project(packageRoot, [
			{ name: "button", release: "2026.10.1", content: SOURCE },
			{ name: "dialog", release: "2026.10.1", content: SOURCE },
		]);

		expect(await uiCheck.run(context)).toEqual({
			status: "warn",
			message: "A copied component is behind release 2026.10.14",
			findings: ["button 2026.10.1 -> changed in 2026.10.14"],
			fix: "sdxc ui update button",
		});
	});

	test("skips a project with no copied component", async () => {
		let context = await project(await kit([entry("button", "2026.9.1")]), []);

		expect((await uiCheck.run(context)).status).toBe("skip");
	});
});
