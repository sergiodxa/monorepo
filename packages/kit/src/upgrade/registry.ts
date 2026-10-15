/**
 * The npm registry as `sdxc upgrade` reads it: a release is a published `@sdxc/kit` version,
 * which ships in every release, with the `remix` version it declares as its peer and the
 * changelog it carries, so the bump knows all three before anything is installed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import { fetchPackument } from "../releases.js";

import type { ChangelogEntry } from "./changelog.js";

import { CHANGELOG_FILE, parseChangelog } from "./changelog.js";

/** Where one published file of a version is served, `<PACKAGE_FILES>/<name>@<version>/<file>`. */
export const PACKAGE_FILES = "https://unpkg.com";

/**
 * The package that marks each release and carries its changelog: every release that ships
 * anything ships it, so its versions are exactly the release dates.
 */
export const RELEASE_PACKAGE = "@sdxc/kit";

/** A published release. */
export interface Release {
	version: string;
	/** The exact `remix` version the release pins as its peer, `null` when it declares none. */
	remix: string | null;
}

/**
 * The release `version` names, or the latest one when it is `null`. A version npm does not
 * have is a failure naming it.
 */
export async function fetchRelease(
	version: string | null,
	signal?: AbortSignal,
): Promise<Result<Release, Error>> {
	let packument = await fetchPackument(RELEASE_PACKAGE, signal);
	if (isFailure(packument)) return packument;
	let target = version ?? packument.data.latest;
	let peers = target === null ? undefined : packument.data.versions.get(target);
	if (target === null || peers === undefined) {
		return failure(new Error(`Release ${version ?? "latest"} is not published on npm`));
	}
	return success({ version: target, remix: peers.remix ?? null });
}

/**
 * The changelog of the release `version`, read from its `@sdxc/kit` before anything is
 * installed so the upgrade can say what breaks on the way.
 */
export async function fetchChangelog(
	version: string,
	signal?: AbortSignal,
): Promise<Result<ChangelogEntry[], Error>> {
	let url = `${PACKAGE_FILES}/${RELEASE_PACKAGE}@${encodeURIComponent(version)}/${CHANGELOG_FILE}`;
	let response = await wrap(() => fetch(url, { signal }));
	if (isFailure(response)) return response;
	if (!response.data.ok) {
		return failure(new Error(`${url} answered ${response.data.status}`));
	}
	let text = await wrap(() => response.data.text());
	if (isFailure(text)) return text;
	return parseChangelog(text.data, url);
}
