#!/usr/bin/env bun
/**
 * First publish for a package npm has never seen: `0.0.0-pre.1` goes out from the operator's
 * own npm session so the package exists and its trusted publisher can be configured; the next
 * daily release then treats the package as new and replaces the placeholder with a dated
 * version. `--dry-run` rehearses everything but the upload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { join } from "node:path";
import { parseArgs } from "node:util";

import type { Result } from "@sdxc/result";

import { failure, isFailure, match, success, wrap } from "@sdxc/result";

import type { Published } from "./plan.js";
import type { Package } from "./workspace.js";

import { buildPackage, createStagingRoot } from "./build.js";
import { headSha } from "./git.js";
import { publishManifest } from "./manifest.js";
import { publish, versionExists, viewPackages, whoami } from "./npm.js";
import { isBootstrapVersion } from "./plan.js";
import { REPOSITORY_URL, REPO_ROOT, readPackages, topologicalOrder } from "./workspace.js";

/** The placeholder every package starts with; the daily release still treats it as new. */
const BOOTSTRAP_VERSION = "0.0.0-pre.1";

/**
 * Bootstraps the requested packages (by default every public package absent from npm),
 * dependencies first, and ends with the trusted-publisher settings to enter on npmjs.com.
 * Every failure comes back as the `Result`, which the entry point turns into exit 1.
 */
async function main(): Promise<Result<void, Error>> {
	let args = wrap(() =>
		parseArgs({
			options: { "dry-run": { type: "boolean", default: false } },
			allowPositionals: true,
		}),
	);
	if (isFailure(args)) return args;
	let { values, positionals } = args.data;
	let dryRun = values["dry-run"] === true;
	let user = await whoami();
	if (user === null) {
		return failure(new Error("npm has no logged-in user; run `npm login`, then rerun"));
	}

	let workspace = await readPackages(REPO_ROOT);
	if (isFailure(workspace)) return workspace;
	let packages = workspace.data;
	let publicPackages = packages.filter((pkg) => !pkg.isPrivate);
	let registry = await viewPackages(publicPackages.map((pkg) => pkg.name));
	if (isFailure(registry)) return registry;
	let published = registry.data;
	let requested =
		positionals.length > 0
			? positionals
			: publicPackages.filter((pkg) => published.get(pkg.name) === null).map((pkg) => pkg.name);
	for (let name of requested) {
		if (!publicPackages.some((pkg) => pkg.name === name)) {
			return failure(new Error(`${name} is not a public workspace package`));
		}
	}
	let order = topologicalOrder(requested, packages);
	if (isFailure(order)) return order;
	if (order.data.length === 0) {
		say("Every public package is already on npm; nothing to bootstrap.");
		return success(undefined);
	}

	let sha = await headSha();
	if (isFailure(sha)) return sha;
	let head = sha.data;
	let stagingRoot = await createStagingRoot();
	if (isFailure(stagingRoot)) return stagingRoot;
	for (let name of order.data) {
		let found = packageNamed(publicPackages, name);
		if (isFailure(found)) return found;
		let pkg = found.data;
		let current = published.get(name) ?? null;
		if (current !== null && !isBootstrapVersion(current.version)) {
			return failure(
				new Error(`${name} is already released as ${current.version}; the daily release owns it`),
			);
		}
		let exists = await versionExists(name, BOOTSTRAP_VERSION);
		if (isFailure(exists)) return exists;
		if (exists.data) {
			say(`${name}@${BOOTSTRAP_VERSION} already exists on npm; skipping`);
			published.set(name, { version: BOOTSTRAP_VERSION, gitHead: null });
			continue;
		}
		let pins = bootstrapPins(pkg, published);
		if (isFailure(pins)) return pins;
		let manifest = publishManifest(pkg, {
			version: BOOTSTRAP_VERSION,
			pins: pins.data,
			gitHead: head,
			repository: { url: REPOSITORY_URL, directory: `packages/${pkg.dir}` },
		});
		if (isFailure(manifest)) return manifest;
		let stagingDir = join(stagingRoot.data, pkg.dir);
		say(`\nBuilding ${name}@${BOOTSTRAP_VERSION} into ${stagingDir}`);
		let built = await buildPackage(pkg, REPO_ROOT, stagingDir, manifest.data);
		if (isFailure(built)) return built;
		say(`${dryRun ? "Dry-run publishing" : "Publishing"} ${name}@${BOOTSTRAP_VERSION} as ${user}`);
		let uploaded = await publish(stagingDir, { dryRun });
		if (isFailure(uploaded)) return uploaded;
		published.set(name, { version: BOOTSTRAP_VERSION, gitHead: head });
	}
	say(`\n${trustedPublisherSteps(order.data)}`);
	return success(undefined);
}

/**
 * Exact pins for a bootstrap: each dependency's latest npm version, counting the ones this
 * run just published (dry or not), so a whole chain bootstraps in one invocation. A
 * dependency still absent is a failure, since the bootstrap has to proceed dependencies first.
 */
function bootstrapPins(
	pkg: Package,
	published: Map<string, Published | null>,
): Result<Record<string, string>, Error> {
	let pins: Record<string, string> = {};
	for (let dependency of pkg.dependencies) {
		let current = published.get(dependency);
		if (current === undefined || current === null) {
			return failure(
				new Error(
					`${pkg.name} depends on ${dependency}, which is not on npm yet; bootstrap ${dependency} first`,
				),
			);
		}
		pins[dependency] = current.version;
	}
	return success(pins);
}

/** The settings npmjs.com asks for, one line per package, so the operator can paste them. */
function trustedPublisherSteps(names: string[]): string {
	let steps = names.map(
		(name) =>
			`- ${name}: https://www.npmjs.com/package/${name}/access → Trusted publisher → GitHub Actions, organization "sergiodxa", repository "monorepo", workflow filename "release.yml", allowed action: publish`,
	);
	return `Configure a trusted publisher for each package on npmjs.com, so the daily release can publish it:\n${steps.join("\n")}`;
}

/** The public package behind a requested name; a miss means the operator asked for something else. */
function packageNamed(packages: Package[], name: string): Result<Package, Error> {
	let pkg = packages.find((candidate) => candidate.name === name);
	if (pkg === undefined) return failure(new Error(`${name} is not a public workspace package`));
	return success(pkg);
}

/** Operator output goes to stdout, leaving stderr to npm's progress and the failure message. */
function say(text: string): void {
	process.stdout.write(`${text}\n`);
}

match(await main(), {
	success: () => {},
	failure: (error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	},
});
