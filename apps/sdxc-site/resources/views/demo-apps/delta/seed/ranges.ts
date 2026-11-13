/**
 * The real commit ranges Delta's seeded pull requests are made of, each named by the subjects
 * of its first and last commit rather than by sha, so the build finds them in whatever history
 * it reads and a pull request's Files changed is always a real diff.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeltaRangeSeed } from "~/app/services/delta/source";

/** Every pull request's range, by its number. */
export const RANGES: DeltaRangeSeed[] = [
	{
		pull: 58,
		from: "feat(sdxc-site): Add Delta's issues list, filtered in GitHub's query grammar",
		to: "feat(sdxc-site): Add Delta's issues list, filtered in GitHub's query grammar",
	},
	{
		pull: 57,
		from: "fix(sdxc-site): Link Delta only to its finished screens",
		to: "feat(sdxc-site): Show every changed file's diff on Delta's commit page",
	},
	{
		pull: 56,
		from: "feat(sdxc-site): Bake Delta's own git history into the build",
		to: "feat(sdxc-site): Add Delta, a code host that browses its own source",
	},
	{
		pull: 55,
		from: "feat(sdxc-site): Add Delta's Actions, with run summaries and a live job log",
		to: "feat(sdxc-site): Add Delta's Actions, with run summaries and a live job log",
	},
];
