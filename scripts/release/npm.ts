/**
 * The npm registry as the release sees it: what is published, whether a user is logged in, and
 * the publish itself. Reads run from the repo root; `publish` runs from the staged package,
 * because npm packs whatever directory it is started in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@sdxc/result";

import { failure, isFailure, isSuccess, success, wrap } from "@sdxc/result";

import type { CommandError, CommandOutput } from "./command.js";
import type { Published } from "./plan.js";

import { run } from "./command.js";
import { REPO_ROOT, TRUSTED_PUBLISHER } from "./workspace.js";

const OUTPUT_LIMIT = 16 * 1024 * 1024;

/** The `npm error code E401` line npm prints on failure, and the first detail line after it. */
const ERROR_CODE_LINE = /^npm error code (\S+)/m;
const ERROR_DETAIL_LINE = /^npm error (?!code )(.+)$/m;

/** Codes npm answers with when the registry does not accept this publisher for the package. */
const PUBLISHER_REJECTIONS = new Set(["E401", "E404", "ENEEDAUTH"]);

export interface PublishOptions {
	dryRun: boolean;
}

interface NpmErrorOutput {
	error: { code: string; summary?: string };
}

/**
 * `npm view --json` output as what a package has published: `null` for `E404` (never
 * published) and for empty output; a bare string, an object, or the last entry of an array
 * otherwise. Any other npm error is a failure naming its code and summary.
 */
export function parsePublished(output: string): Result<Published | null, Error> {
	let text = output.trim();
	if (text === "") return success(null);
	let value = wrap(() => JSON.parse(text) as unknown);
	if (isFailure(value)) return value;
	if (isNpmError(value.data)) {
		if (value.data.error.code === "E404") return success(null);
		return failure(
			new Error(
				`npm view failed with ${value.data.error.code}: ${value.data.error.summary ?? "no summary"}`,
			),
		);
	}
	return publishedFrom(value.data);
}

/** The latest version of `name` on npm with its `gitHead`, or `null` when npm has never seen it. */
export async function viewPackage(name: string): Promise<Result<Published | null, Error>> {
	return viewed(await npm(["view", name, "version", "gitHead", "--json"]));
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

/** Whether `name@version` exists on npm. */
export async function versionExists(
	name: string,
	version: string,
): Promise<Result<boolean, Error>> {
	let published = viewed(await npm(["view", `${name}@${version}`, "version", "--json"]));
	if (isFailure(published)) return published;
	return success(published.data !== null);
}

/** The logged-in npm user, or `null` when this machine holds no npm session. */
export async function whoami(): Promise<string | null> {
	let result = await run("npm", ["whoami"], { cwd: REPO_ROOT });
	if (isFailure(result)) return null;
	return result.data.stdout.trim() || null;
}

/**
 * `npm publish` from the staged package, streaming npm's progress to the operator. Every
 * publish names `latest` explicitly: npm demands a tag for a prerelease, and the bootstrap
 * placeholder is the package's only version until the dated release replaces it. A failure
 * carries npm's error code, and a rejection of the publisher adds the trusted publisher
 * settings the package needs on npmjs.com.
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
	let args = ["publish", "--tag", "latest", ...(options.dryRun ? ["--dry-run"] : [])];
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

/** Runs npm at the repo root, where every registry read happens. */
async function npm(args: string[]): Promise<Result<CommandOutput, CommandError>> {
	return run("npm", args, { cwd: REPO_ROOT, maxBuffer: OUTPUT_LIMIT });
}

/**
 * What `npm view --json` answered, read from stdout even when npm exited non-zero, because
 * `--json` puts the error object there; a failure with nothing on stdout (npm missing, killed)
 * passes through as the command's own error.
 */
function viewed(result: Result<CommandOutput, CommandError>): Result<Published | null, Error> {
	if (isSuccess(result)) return parsePublished(result.data.stdout);
	if (result.error.stdout.trim() !== "") return parsePublished(result.error.stdout);
	return result;
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

function publishedFrom(value: unknown): Result<Published | null, Error> {
	if (typeof value === "string") return success({ version: value, gitHead: null });
	if (Array.isArray(value)) {
		return value.length === 0 ? success(null) : publishedFrom(value[value.length - 1]);
	}
	if (isRecord(value) && typeof value.version === "string") {
		return success({
			version: value.version,
			gitHead: typeof value.gitHead === "string" ? value.gitHead : null,
		});
	}
	return failure(new Error(`Unexpected npm view output: ${JSON.stringify(value)}`));
}

function isNpmError(value: unknown): value is NpmErrorOutput {
	return isRecord(value) && isRecord(value.error) && typeof value.error.code === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
