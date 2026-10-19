/**
 * What every `sdxc doctor` check shares: the result it answers, the project context it reads,
 * and the run that takes a list of checks in order. A new check is one more entry in the list,
 * reading the same memoized manifest and registry documents as the others.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import type { Config } from "../config.js";
import type { PackageManager } from "../package-manager.js";
import type { Packument } from "../releases.js";
import type { Manifest } from "../upgrade/project.js";

import { fetchPackument } from "../releases.js";

/** How a check came out; only `fail` makes the run exit 1. */
export type CheckStatus = "pass" | "warn" | "fail" | "skip";

/** What one check found. */
export interface CheckResult {
	status: CheckStatus;
	/** One sentence summing up what the check found, or why it was skipped. */
	message: string;
	/** Each package or key the check flagged, in the order it read them. */
	findings: string[];
	/** The command or edit that clears a warning or failure, `null` when there is none to make. */
	fix: string | null;
}

/** A named check, run against the project once per `sdxc doctor`. */
export interface Check {
	/** The check's name in the report, one lowercase word. */
	name: string;
	run(context: DoctorContext): Promise<CheckResult>;
}

/** A check's result under its name, as the report prints it. */
export interface CheckReport extends CheckResult {
	name: string;
}

/** The project every check reads, loaded once per run. */
export interface DoctorContext {
	root: string;
	manifest: Manifest;
	config: Config;
	manager: PackageManager;
	/** The `@sdxc/kit` package whose component registry the copies are compared with. */
	packageRoot: string;
	/**
	 * The registry document for `name`, fetched at most once per run, so checks that read the
	 * same package share a request and agree on what the registry answered.
	 */
	packument(name: string): Promise<Result<Packument, Error>>;
}

/** What `createDoctorContext` needs to build a context. */
export interface DoctorContextOptions {
	root: string;
	manifest: Manifest;
	config: Config;
	manager: PackageManager;
	packageRoot: string;
	signal?: AbortSignal;
}

/** A context whose registry reads are memoized by package name. */
export function createDoctorContext(options: DoctorContextOptions): DoctorContext {
	let fetched = new Map<string, Promise<Result<Packument, Error>>>();
	return {
		root: options.root,
		manifest: options.manifest,
		config: options.config,
		manager: options.manager,
		packageRoot: options.packageRoot,
		packument(name) {
			let pending = fetched.get(name);
			if (pending === undefined) {
				pending = fetchPackument(name, options.signal);
				fetched.set(name, pending);
			}
			return pending;
		},
	};
}

/** Runs `checks` one after another, so the report keeps their order. */
export async function runChecks(
	checks: readonly Check[],
	context: DoctorContext,
): Promise<CheckReport[]> {
	let reports: CheckReport[] = [];
	for (let check of checks) reports.push({ name: check.name, ...(await check.run(context)) });
	return reports;
}

/**
 * The range `package.json` gives `name`, read from its dependency sections in the order an
 * install resolves them, or an empty string when none lists it.
 */
export function rangeOf(manifest: Manifest, name: string): string {
	return (
		manifest.dependencies?.[name] ??
		manifest.devDependencies?.[name] ??
		manifest.optionalDependencies?.[name] ??
		""
	);
}

/** A result with no findings and no fix. */
export function passed(message: string): CheckResult {
	return { status: "pass", message, findings: [], fix: null };
}

/** A result for a check that could not judge the project, saying why. */
export function skipped(message: string): CheckResult {
	return { status: "skip", message, findings: [], fix: null };
}
