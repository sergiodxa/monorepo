/**
 * The npm registry as the release sees it: what is published, whether a user is logged in, and
 * the publish itself. What is published is read from the registry's own packument, so a
 * package whose only version sits under a pre-release tag is still seen; `publish` runs from
 * the staged package, because npm packs whatever directory it is started in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { CommandError } from "./command.js";
import type { Published } from "./plan.js";

import { run, runInteractive } from "./command.js";
import { REPO_ROOT, TRUSTED_PUBLISHER } from "./workspace.js";

const OUTPUT_LIMIT = 16 * 1024 * 1024;

/** The registry every public package publishes to; a package's packument lives at `/<name>`. */
const REGISTRY_URL = "https://registry.npmjs.org";

/** The status the registry answers with for a packument it does not have. */
const PACKUMENT_ABSENT = [404];

/**
 * The statuses the dist-tags endpoint answers with for a package it does not have. That
 * endpoint speaks for a session rather than for the public, so it refuses an unknown package
 * with a 401 instead of saying it does not exist.
 */
const DIST_TAGS_ABSENT = [404, 401];

/** The `npm error code E401` line npm prints on failure, and the first detail line after it. */
const ERROR_CODE_LINE = /^npm error code (\S+)/m;
const ERROR_DETAIL_LINE = /^npm error (?!code )(.+)$/m;

/** Codes npm answers with when the registry does not accept this publisher for the package. */
const PUBLISHER_REJECTIONS = new Set(["E401", "E404", "ENEEDAUTH"]);

export interface PublishOptions {
	dryRun: boolean;
	/** The dist-tag the version publishes under: `latest` for a dated release, another for a placeholder. */
	tag: string;
	/**
	 * Hands npm the terminal, which an operator's session needs: npm completes the account's
	 * second-factor challenge in the browser only when stdin and stdout are a TTY. A CI publish
	 * authenticates through OIDC and keeps its output captured.
	 */
	interactive?: boolean;
}

/** The parts of a registry packument the release reads. */
interface Packument {
	"dist-tags"?: Record<string, string>;
	versions?: Record<string, { gitHead?: unknown }>;
}

/**
 * The registry's packument as what a package has published: the `latest` version with its
 * `gitHead`, or the highest version when no `latest` tag exists yet, which is how a package
 * looks after the bootstrap published its placeholder under another tag. `null` when the
 * packument holds no versions.
 */
export function parsePackument(value: unknown): Result<Published | null, Error> {
	if (!isRecord(value)) {
		return failure(new Error(`Unexpected registry response: ${JSON.stringify(value)}`));
	}
	let packument = value as Packument;
	let versions = packument.versions ?? {};
	let names = Object.keys(versions);
	if (names.length === 0) return success(null);
	let latest = packument["dist-tags"]?.latest ?? highestVersion(names);
	let gitHead = versions[latest]?.gitHead;
	return success({ version: latest, gitHead: typeof gitHead === "string" ? gitHead : null });
}

/**
 * The latest version of `name` on npm with its `gitHead`, or `null` when npm has never seen it.
 * The dist-tags endpoint answers for a package the registry has just created while its
 * packument still lags behind, so a bootstrapped package is seen from its first minute.
 */
export async function viewPackage(name: string): Promise<Result<Published | null, Error>> {
	let packument = await fetchPackument(name);
	if (isFailure(packument)) return packument;
	if (packument.data !== null) return parsePackument(packument.data);
	let tags = await fetchDistTags(name);
	if (isFailure(tags)) return tags;
	return success(tags.data === null ? null : publishedFromDistTags(tags.data));
}

/**
 * What a package's dist-tags alone say it has published: the `latest` version, or the highest
 * tagged one, with no `gitHead` because tags carry none; `null` for a package without tags.
 */
export function publishedFromDistTags(tags: Record<string, string>): Published | null {
	let versions = Object.values(tags);
	if (versions.length === 0) return null;
	return { version: tags.latest ?? highestVersion(versions), gitHead: null };
}

/** `viewPackage` for every name at once, keyed by name; one failure lists every name that failed. */
export async function viewPackages(
	names: string[],
): Promise<Result<Map<string, Published | null>, Error>> {
	let entries = await Promise.all(
		names.map(async (name) => [name, await viewPackage(name)] as const),
	);
	let published = new Map<string, Published | null>();
	let problems: string[] = [];
	for (let [name, result] of entries) {
		if (isFailure(result)) problems.push(`${name}: ${result.error.message}`);
		else published.set(name, result.data);
	}
	if (problems.length > 0) return failure(new Error(problems.join("\n")));
	return success(published);
}

/** Whether `name@version` exists on npm, read from the packument or, while it lags, the dist-tags. */
export async function versionExists(
	name: string,
	version: string,
): Promise<Result<boolean, Error>> {
	let packument = await fetchPackument(name);
	if (isFailure(packument)) return packument;
	if (packument.data !== null && isRecord(packument.data)) {
		return success(version in ((packument.data as Packument).versions ?? {}));
	}
	let tags = await fetchDistTags(name);
	if (isFailure(tags)) return tags;
	return success(tags.data !== null && Object.values(tags.data).includes(version));
}

/**
 * The highest of `versions` by SemVer order, so a lone `0.0.0-pre.1` placeholder ranks below
 * any dated release and `pre.2` above `pre.1`.
 */
export function highestVersion(versions: string[]): string {
	return [...versions].sort(compareVersions).at(-1) ?? "";
}

/** The logged-in npm user, or `null` when this machine holds no npm session. */
export async function whoami(): Promise<string | null> {
	let result = await run("npm", ["whoami"], { cwd: REPO_ROOT });
	if (isFailure(result)) return null;
	return result.data.stdout.trim() || null;
}

/**
 * `npm publish` from the staged package under `options.tag`, streaming npm's progress to the
 * operator. A failure carries npm's error code, and a rejection of the publisher adds the
 * trusted publisher settings the package needs on npmjs.com.
 */
export async function publish(
	stagingDir: string,
	options: PublishOptions,
): Promise<Result<void, Error>> {
	let manifest = await wrap(
		async () =>
			JSON.parse(await readFile(join(stagingDir, "package.json"), "utf8")) as { name: string },
	);
	if (isFailure(manifest)) return manifest;
	let args = ["publish", "--tag", options.tag, ...(options.dryRun ? ["--dry-run"] : [])];
	if (options.interactive === true) {
		let outcome = await runInteractive("npm", args, { cwd: stagingDir });
		if (isFailure(outcome)) {
			return failure(
				new Error(
					`npm publish of ${manifest.data.name} failed (${outcome.error.code ?? "signal"}); npm's own report is above`,
				),
			);
		}
		return success(undefined);
	}
	let result = await run("npm", args, {
		cwd: stagingDir,
		maxBuffer: OUTPUT_LIMIT,
		onStderr: (chunk) => {
			process.stderr.write(chunk);
		},
	});
	if (isFailure(result)) return failure(publishFailure(manifest.data.name, result.error));
	process.stdout.write(result.data.stdout);
	return success(undefined);
}

/**
 * The registry's packument for `name`, `null` when the registry answers 404 (the package has
 * never been published). Reading the registry directly, instead of through `npm view`, needs
 * no `latest` tag to exist.
 */
async function fetchPackument(name: string): Promise<Result<unknown, Error>> {
	return registryJson(`${REGISTRY_URL}/${registryPath(name)}`, PACKUMENT_ABSENT);
}

/** The package's dist-tags as tag → version, `null` when the registry has no package to tag. */
async function fetchDistTags(name: string): Promise<Result<Record<string, string> | null, Error>> {
	let json = await registryJson(
		`${REGISTRY_URL}/-/package/${registryPath(name)}/dist-tags`,
		DIST_TAGS_ABSENT,
	);
	if (isFailure(json)) return json;
	if (json.data === null) return success(null);
	if (!isRecord(json.data)) {
		return failure(new Error(`Unexpected dist-tags response: ${JSON.stringify(json.data)}`));
	}
	let tags: Record<string, string> = {};
	for (let [tag, version] of Object.entries(json.data)) {
		if (typeof version === "string") tags[tag] = version;
	}
	return success(tags);
}

/**
 * The JSON the registry serves at `url`, `null` for a status in `absent`, which is how that
 * endpoint says it has no such package; any other status is a failure.
 */
async function registryJson(url: string, absent: number[]): Promise<Result<unknown, Error>> {
	let response = await wrap(() => fetch(url));
	if (isFailure(response)) return response;
	if (absent.includes(response.data.status)) return success(null);
	if (!response.data.ok) {
		return failure(
			new Error(`${url} answered ${response.data.status} ${response.data.statusText}`),
		);
	}
	return wrap(() => response.data.json());
}

/** `@sdxc/result` as the registry spells it in a path, with the scope separator encoded. */
function registryPath(name: string): string {
	return name.replace("/", "%2F");
}

/** SemVer order for the versions this repository publishes: numeric cores, then pre-release identifiers. */
function compareVersions(a: string, b: string): number {
	let [coreA = "", preA] = a.split("-", 2);
	let [coreB = "", preB] = b.split("-", 2);
	let partsA = coreA.split(".").map(Number);
	let partsB = coreB.split(".").map(Number);
	for (let index = 0; index < 3; index += 1) {
		let difference = (partsA[index] ?? 0) - (partsB[index] ?? 0);
		if (difference !== 0) return difference;
	}
	if (preA === undefined || preB === undefined)
		return (preA === undefined ? 1 : 0) - (preB === undefined ? 1 : 0);
	return comparePrerelease(preA.split("."), preB.split("."));
}

/** Dot-separated pre-release identifiers compare numerically when both are numbers, as strings otherwise. */
function comparePrerelease(a: string[], b: string[]): number {
	for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
		let left = a[index];
		let right = b[index];
		if (left === undefined) return -1;
		if (right === undefined) return 1;
		let numeric = /^\d+$/.test(left) && /^\d+$/.test(right);
		let difference = numeric ? Number(left) - Number(right) : left.localeCompare(right);
		if (difference !== 0) return difference;
	}
	return 0;
}

/**
 * npm's own error code and first detail line, read from its stderr, so the operator sees
 * `E403` and the registry's own sentence.
 */
function publishFailure(name: string, error: CommandError): Error {
	let code = ERROR_CODE_LINE.exec(error.stderr)?.[1] ?? "no code";
	let detail = ERROR_DETAIL_LINE.exec(error.stderr)?.[1] ?? error.message;
	let hint = PUBLISHER_REJECTIONS.has(code)
		? ` npm did not accept this publisher for ${name}; configure its trusted publisher on npmjs.com (${TRUSTED_PUBLISHER}).`
		: "";
	return new Error(`npm publish of ${name} failed (${code}): ${detail}.${hint}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
