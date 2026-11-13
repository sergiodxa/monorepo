/**
 * Tests for the match rule a file tree's filter shares between the server and the island:
 * every term must appear in the path, case aside, and a blank query keeps every file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { treeFilterMatches } from "./tree-filter.js";

describe("treeFilterMatches", () => {
	test("keeps every path for a blank query", () => {
		expect(treeFilterMatches("app/routes.ts", "")).toBe(true);
		expect(treeFilterMatches("app/routes.ts", "   ")).toBe(true);
	});

	test("matches a term anywhere in the path, ignoring case", () => {
		expect(treeFilterMatches("app/Routes.ts", "ROUTES")).toBe(true);
		expect(treeFilterMatches("app/routes.ts", "worker")).toBe(false);
	});

	test("requires every term", () => {
		expect(treeFilterMatches("packages/ui/src/app/tree.tsx", "ui tree")).toBe(true);
		expect(treeFilterMatches("packages/ui/src/app/tree.tsx", "ui diff")).toBe(false);
	});
});
