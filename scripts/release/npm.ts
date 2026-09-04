/**
 * The npm registry as the release sees it: what is published, whether a user is logged in, and
 * the publish itself. Reads run from the repo root; `publish` runs from the staged package,
 * because npm packs whatever directory it is started in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import type { Published } from "./plan.js";

import { REPO_ROOT, TRUSTED_PUBLISHER } from "./workspace.js";

const execFileAsync = promisify(execFile);

const OUTPUT_LIMIT = 16 * 1024 * 1024;

/** The `npm error code E401` line npm prints on failure, and the first detail line after it. */
const ERROR_CODE_LINE = /^npm error code (\S+)/m;
const ERROR_DETAIL_LINE = /^npm error (?!code )(.+)$/m;

/** Codes npm answers with when the registry does not accept this publisher for the package. */
const PUBLISHER_REJECTIONS = new Set(["E401", "E404", "ENEEDAUTH"]);

export interface PublishOptions {
	dryRun: boolean;
}

/** The properties `execFile` attaches to a rejection, all optional since any error may arrive. */
interface ExecFailure {
	stdout?: string;
	stderr?: string;
}

interface NpmErrorOutput {
	error: { code: string; summary?: string };
}

/**
 * `npm view --json` output as what a package has published: `null` for `E404` (never
 * published) and for empty output; a bare string, an object, or the last entry of an array
 * otherwise. Any other npm error is thrown with its code and summary.
 */
export function parsePublished(output: string): Published | null {
	let text = output.trim();
	if (text === "") return null;
	let value: unknown = JSON.parse(text);
	if (isNpmError(value)) {
		if (value.error.code === "E404") return null;
		throw new Error(
			`npm view failed with ${value.error.code}: ${value.error.summary ?? "no summary"}`,
		);
	}
	return publishedFrom(value);
}

/** The latest version of `name` on npm with its `gitHead`, or `null` when npm has never seen it. */
export async function viewPackage(name: string): Promise<Published | null> {
	return parsePublished(await npmOutput(["view", name, "version", "gitHead", "--json"]));
}

/** `viewPackage` for every name at once, keyed by name. */
export async function viewPackages(names: string[]): Promise<Map<string, Published | null>> {
	let entries = await Promise.all(
		names.map(async (name) => [name, await viewPackage(name)] as const),
	);
	return new Map(entries);
}

/** Whether `name@version` exists on npm. */
export async function versionExists(name: string, version: string): Promise<boolean> {
	return (
		parsePublished(await npmOutput(["view", `${name}@${version}`, "version", "--json"])) !== null
	);
}

/** The logged-in npm user, or `null` when this machine holds no npm session. */
export async function whoami(): Promise<string | null> {
	try {
		let { stdout } = await execFileAsync("npm", ["whoami"], { cwd: REPO_ROOT });
		return stdout.trim() || null;
	} catch {
		return null;
	}
}

/**
 * `npm publish` from the staged package, streaming npm's progress to the operator. A failure
 * is rethrown with npm's error code, and a rejection of the publisher adds the trusted
 * publisher settings the package needs on npmjs.com.
 */
export async function publish(stagingDir: string, options: PublishOptions): Promise<void> {
	let manifest = JSON.parse(await readFile(join(stagingDir, "package.json"), "utf8")) as {
		name: string;
	};
	let args = ["publish", ...(options.dryRun ? ["--dry-run"] : [])];
	let pending = execFileAsync("npm", args, { cwd: stagingDir, maxBuffer: OUTPUT_LIMIT });
	pending.child.stderr?.on("data", (chunk: Buffer | string) => {
		process.stderr.write(chunk);
	});
	try {
		let { stdout } = await pending;
		process.stdout.write(stdout);
	} catch (error) {
		throw publishFailure(manifest.name, error);
	}
}

/**
 * npm's stdout even when it exits non-zero, because `--json` puts the error object there;
 * a failure with nothing on stdout (npm missing, killed) is rethrown as is.
 */
async function npmOutput(args: string[]): Promise<string> {
	try {
		let { stdout } = await execFileAsync("npm", args, {
			cwd: REPO_ROOT,
			maxBuffer: OUTPUT_LIMIT,
		});
		return stdout;
	} catch (error) {
		let stdout = failureStreams(error).stdout ?? "";
		if (stdout.trim() !== "") return stdout;
		throw error;
	}
}

/**
 * npm's own error code and first detail line, read from its stderr, so the operator sees
 * `E403` and the registry's sentence rather than a generic non-zero exit.
 */
function publishFailure(name: string, error: unknown): Error {
	let stderr = failureStreams(error).stderr ?? "";
	let code = ERROR_CODE_LINE.exec(stderr)?.[1] ?? "no code";
	let detail =
		ERROR_DETAIL_LINE.exec(stderr)?.[1] ?? (error instanceof Error ? error.message : String(error));
	let hint = PUBLISHER_REJECTIONS.has(code)
		? ` npm did not accept this publisher for ${name}; configure its trusted publisher on npmjs.com (${TRUSTED_PUBLISHER}).`
		: "";
	return new Error(`npm publish of ${name} failed (${code}): ${detail}.${hint}`);
}

function failureStreams(error: unknown): ExecFailure {
	return typeof error === "object" && error !== null ? (error as ExecFailure) : {};
}

function publishedFrom(value: unknown): Published | null {
	if (typeof value === "string") return { version: value, gitHead: null };
	if (Array.isArray(value)) {
		return value.length === 0 ? null : publishedFrom(value[value.length - 1]);
	}
	if (isRecord(value) && typeof value.version === "string") {
		return {
			version: value.version,
			gitHead: typeof value.gitHead === "string" ? value.gitHead : null,
		};
	}
	throw new Error(`Unexpected npm view output: ${JSON.stringify(value)}`);
}

function isNpmError(value: unknown): value is NpmErrorOutput {
	return isRecord(value) && isRecord(value.error) && typeof value.error.code === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
