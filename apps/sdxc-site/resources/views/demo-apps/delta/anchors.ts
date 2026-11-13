/**
 * The lines Delta's seeded issues, review threads and annotations cite, written by content
 * rather than by number, so each citation follows its code from commit to commit; the build
 * resolves them against the deployed files and marks any that no longer match as outdated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeltaAnchorSeed } from "~/app/services/delta/source";

/** Every citation the seed data makes, by the id a seeded record names it with. */
export const ANCHORS: DeltaAnchorSeed[] = [
	{
		id: "readme-how",
		path: "README.md",
		match: "## How a Worker shows git history",
		span: 1,
	},
];
