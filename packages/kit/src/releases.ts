/**
 * The kit's one notion of a release: `@sdxc/*` versions are UTC dates and a daily release
 * republishes only what changed, so a package at release D is its newest version on or before D,
 * read from the npm registry. `create`, `make` and `upgrade` all pin through here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import * as s from "@sdxc/json-schema";
import { failure, isFailure, success, wrap } from "@sdxc/result";
import { compare } from "@sdxc/semver";

/** Where npm serves a package's registry document, `<REGISTRY>/<name>`. */
export const REGISTRY = "https://registry.npmjs.org";

/** The scope every package the kit pins is published under. */
export const SCOPE = "@sdxc/";

/** A dated release version, `2026.10.14`; the bootstrap placeholder and prereleases are not one. */
const DATED_VERSION = /^\d{4}\.\d{1,2}\.\d{1,2}$/;

/** An exact pin as a manifest may spell it, with an optional range operator before a dated version. */
const DATED_PIN = /^[\^~=]?v?(\d{4}\.\d{1,2}\.\d{1,2})$/;

/** The fields of a registry document the kit reads. */
const PACKUMENT_SCHEMA = s.object({
	"dist-tags": s.optional(s.record(s.string(), s.string())),
	versions: s.optional(
		s.record(
			s.string(),
			s.object({ peerDependencies: s.optional(s.record(s.string(), s.string())) }),
		),
	),
});

/** What the registry knows about one package. */
export interface Packument {
	name: string;
	/** The version the `latest` dist-tag points at, `null` when it has none. */
	latest: string | null;
	/** Every published version with the peers it declares. */
	versions: Map<string, Record<string, string>>;
}

/**
 * The registry document for `name`. A package npm does not have is a failure naming it, as is
 * an unreachable registry or a document without versions.
 */
export async function fetchPackument(
	name: string,
	signal?: AbortSignal,
): Promise<Result<Packument, Error>> {
	let url = `${REGISTRY}/${name.replaceAll("/", "%2f")}`;
	let response = await wrap(() => fetch(url, { headers: { accept: "application/json" }, signal }));
	if (isFailure(response)) {
		return failure(new Error(`Could not reach the npm registry: ${response.error.message}`));
	}
	if (response.data.status === 404) return failure(new Error(`${name} is not published on npm`));
	if (!response.data.ok) {
		return failure(new Error(`The npm registry answered ${response.data.status} for ${url}`));
	}
	let body = await wrap(() => response.data.json());
	if (isFailure(body)) return failure(new Error(`The npm registry sent invalid JSON for ${url}`));
	let checked = s.parseSafe(PACKUMENT_SCHEMA, body.data);
	if (!checked.success) return failure(new Error(`The npm registry sent no versions for ${url}`));
	let versions = new Map<string, Record<string, string>>();
	for (let [version, manifest] of Object.entries(checked.value.versions ?? {})) {
		versions.set(version, manifest.peerDependencies ?? {});
	}
	return success({ name, latest: checked.value["dist-tags"]?.latest ?? null, versions });
}

/** The newest dated version of `packument` on or before the release `release`, or `null`. */
export function versionAtRelease(packument: Packument, release: string): string | null {
	let found: string | null = null;
	for (let version of packument.versions.keys()) {
		if (!DATED_VERSION.test(version) || compare(version, release) > 0) continue;
		if (found === null || compare(version, found) > 0) found = version;
	}
	return found;
}

/**
 * The exact version of each of `names` at `release`, or at its `latest` dist-tag when `release`
 * is `null`. A package with no version at that release is a failure naming both.
 */
export async function resolveRelease(
	names: Iterable<string>,
	release: string | null,
	signal?: AbortSignal,
): Promise<Result<Map<string, string>, Error>> {
	let sorted = [...new Set(names)].sort();
	let fetched = await Promise.all(sorted.map((name) => fetchPackument(name, signal)));
	let versions = new Map<string, string>();
	for (let packument of fetched) {
		if (isFailure(packument)) return packument;
		let { name } = packument.data;
		let version =
			release === null ? packument.data.latest : versionAtRelease(packument.data, release);
		if (version === null) {
			return failure(
				new Error(
					release === null
						? `${name} has no latest version on npm`
						: `${name} has no release on or before ${release}`,
				),
			);
		}
		versions.set(name, version);
	}
	return success(versions);
}

/**
 * The release a project is on: the newest date among the exact `@sdxc/*` pins its dependency
 * sections list, or `null` when it pins none to a dated version.
 */
export function projectRelease(
	sections: ReadonlyArray<Readonly<Record<string, string>> | undefined>,
): string | null {
	let newest: string | null = null;
	for (let section of sections) {
		for (let [name, range] of Object.entries(section ?? {})) {
			if (!name.startsWith(SCOPE)) continue;
			let version = datedPin(range);
			if (version === null) continue;
			if (newest === null || compare(version, newest) > 0) newest = version;
		}
	}
	return newest;
}

/** The dated version an exact pin names, `2026.10.14` from `^2026.10.14`, or `null` for any other range. */
export function datedPin(range: string): string | null {
	return DATED_PIN.exec(range.trim())?.[1] ?? null;
}

/** The npm package a module specifier comes from, `@sdxc/auth/issuer` from `@sdxc/auth`, or `null`. */
export function scopedPackageOf(specifier: string): string | null {
	if (!specifier.startsWith(SCOPE)) return null;
	let name = specifier.split("/").slice(0, 2).join("/");
	return name.length > SCOPE.length ? name : null;
}
