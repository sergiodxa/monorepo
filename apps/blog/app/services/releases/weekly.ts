/**
 * The one call the weekly releases job makes: read every configured repository's releases
 * for the week a run covers and summarize the packages they shipped, so the job only has to
 * upsert the post the summary describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";

import type { GitHubRelease } from "~/app/services/releases/github";
import type { WeeklyReleaseSummary } from "~/app/services/releases/packages";
import type { ReleaseSource } from "~/config/releases";

import { listReleases } from "~/app/services/releases/github";
import { weeklyReleaseSummary } from "~/app/services/releases/packages";
import { releaseWeek } from "~/app/services/releases/week";
import { RELEASE_SOURCES } from "~/config/releases";

/**
 * Summarizes the packages released during the week a run at `now` covers.
 *
 * @param now When the run happens; a late or retried run covers the scheduled run's week.
 * @param token The GitHub credential the releases are read with.
 * @param sources The repositories to read.
 * @returns The summary to upsert the post from, `null` for a week with no qualifying package, or the first repository that could not be read: a partial list would publish a post missing packages, so the run fails and its retry reads every repository again.
 * @example await weeklyReleases(new Date(scheduledTime), env.GITHUB_TOKEN);
 */
export async function weeklyReleases(
	now: Date,
	token: string,
	sources: ReleaseSource[] = RELEASE_SOURCES,
): Promise<Result<WeeklyReleaseSummary | null, Error>> {
	let week = releaseWeek(now);
	let listed = await Promise.all(
		sources.map((source) => listReleases(source.repository, week, token)),
	);

	let releases: GitHubRelease[] = [];
	for (let result of listed) {
		if (isFailure(result)) return failure(result.error);
		releases.push(...result.data);
	}

	let summary = weeklyReleaseSummary(week.slug, releases, sources);
	currentLog()?.set({
		releases: {
			week: week.slug,
			releases: releases.length,
			packages: summary?.packages.length ?? 0,
		},
	});

	return success(summary);
}
