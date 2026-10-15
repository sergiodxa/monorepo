/**
 * The npm registry as `sdxc upgrade` reads it: one published `sdxc` version, the `remix` version
 * it declares as its peer, and the changelog it ships, so the bump knows all three before
 * anything is installed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import * as s from "@sdxc/json-schema";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { ChangelogEntry } from "./changelog.js";

import { CHANGELOG_FILE, parseChangelog } from "./changelog.js";

/** Where npm serves one version's manifest, `<REGISTRY>/sdxc/<version or dist-tag>`. */
export const REGISTRY = "https://registry.npmjs.org";

/** Where one published file of a version is served, `<PACKAGE_FILES>/sdxc@<version>/<file>`. */
export const PACKAGE_FILES = "https://cdn.jsdelivr.net/npm";

/** The fields of a version manifest the upgrade reads. */
const VERSION_SCHEMA = s.object({
	version: s.string(),
	peerDependencies: s.optional(s.record(s.string(), s.string())),
});

/** A published `sdxc` release. */
export interface Release {
	version: string;
	/** The exact `remix` version the release pins as its peer, `null` when it declares none. */
	remix: string | null;
}

/**
 * The `sdxc` release `version` names, or the one the `latest` dist-tag points at when it is
 * `null`. A version npm does not have is a failure naming it.
 */
export async function fetchRelease(
	version: string | null,
	signal?: AbortSignal,
): Promise<Result<Release, Error>> {
	let url = `${REGISTRY}/sdxc/${encodeURIComponent(version ?? "latest")}`;
	let response = await wrap(() => fetch(url, { headers: { accept: "application/json" }, signal }));
	if (isFailure(response)) {
		return failure(new Error(`Could not reach the npm registry: ${response.error.message}`));
	}
	if (response.data.status === 404) {
		return failure(new Error(`sdxc@${version ?? "latest"} is not published on npm`));
	}
	if (!response.data.ok) {
		return failure(new Error(`The npm registry answered ${response.data.status} for ${url}`));
	}
	let body = await wrap(() => response.data.json());
	if (isFailure(body)) return failure(new Error(`The npm registry sent invalid JSON for ${url}`));
	let checked = s.parseSafe(VERSION_SCHEMA, body.data);
	if (!checked.success) return failure(new Error(`The npm registry sent no version for ${url}`));
	return success({
		version: checked.value.version,
		remix: checked.value.peerDependencies?.remix ?? null,
	});
}

/**
 * The changelog the published `sdxc` release `version` ships, read before it is installed so
 * the upgrade can say what breaks on the way.
 */
export async function fetchChangelog(
	version: string,
	signal?: AbortSignal,
): Promise<Result<ChangelogEntry[], Error>> {
	let url = `${PACKAGE_FILES}/sdxc@${encodeURIComponent(version)}/${CHANGELOG_FILE}`;
	let response = await wrap(() => fetch(url, { signal }));
	if (isFailure(response)) return response;
	if (!response.data.ok) {
		return failure(new Error(`${url} answered ${response.data.status}`));
	}
	let text = await wrap(() => response.data.text());
	if (isFailure(text)) return text;
	return parseChangelog(text.data, url);
}
