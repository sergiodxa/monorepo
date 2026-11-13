/**
 * The lines Delta's seeded issues, review threads and annotations cite, written by content
 * rather than by number, so each citation follows its code from commit to commit; the build
 * resolves them against the deployed files and marks any that no longer match as outdated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeltaAnchorSeed } from "~/app/services/delta/source";

/** The commit that added Delta, which most citations were written against. */
const ADDED = "feat(sdxc-site): Add Delta, a code host that browses its own source";

/** The commit that drew a commit's diffs, which the review citations were written against. */
const DIFFS = "feat(sdxc-site): Show every changed file's diff on Delta's commit page";

/** Every citation the seed data makes, by the id a seeded record names it with. */
export const ANCHORS: DeltaAnchorSeed[] = [
	{
		id: "format-bytes",
		path: "data.ts",
		match: "export function formatBytes(bytes: number): string {",
		span: 4,
		written: ADDED,
	},
	{
		id: "initials",
		path: "data.ts",
		match: "export function initials(name: string): string {",
		span: 6,
		written: ADDED,
	},
	{
		id: "utc-days",
		path: "data.ts",
		match: "let day = date.toISOString().slice(0, 10);",
		written: ADDED,
	},
	{
		id: "wide-pane",
		path: "shell.tsx",
		match: 'const WITH_PANE = "(min-width: 64rem)";',
		written: ADDED,
	},
	{
		id: "hue-of",
		path: "glyphs.tsx",
		match: "function hueOf(name: string): number {",
		span: 7,
		written: ADDED,
	},
	{
		id: "large-diff",
		path: "diffs.tsx",
		match: "export const LARGE_DIFF = 400;",
		written: DIFFS,
	},
	{
		id: "in-place",
		path: "diff-island.tsx",
		match: "function markInPlace(event: Event): void {",
		span: 6,
		written: DIFFS,
	},
	{ id: "issue-42", path: "seed/issues.ts", match: "number: 42,", span: 4 },
	{
		id: "readme-how",
		path: "README.md",
		match: "## How a Worker shows git history",
		span: 1,
	},
	{
		id: "ci-phone-scroll",
		path: "frames.browser.test.tsx",
		match: "expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);",
		span: 1,
	},
	{
		id: "ci-utc-days",
		path: "data.ts",
		match: "export function groupByDay<",
		span: 3,
	},
];
