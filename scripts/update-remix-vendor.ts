/**
 * Updates docs/vendor and .agents/skills/remix from the Remix release the
 * workspaces pin, so the vendored docs describe the installed version.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, readdir, readFile, rm, stat, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { $ } from "bun";

let REMIX_TARBALL_BASE = "https://api.github.com/repos/remix-run/remix/tarball";
let DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies"] as const;
let ROOT_DIR = resolve(import.meta.dir, "..");
let VENDOR_DIR = join(ROOT_DIR, "docs", "vendor");
let SKILLS_DIR = join(ROOT_DIR, ".agents", "skills");
let TEMP_DIR = join(tmpdir(), "sergiodxa-remix-vendor");
let TAR_PATH = join(TEMP_DIR, "remix.tar.gz");
let EXTRACT_DIR = join(TEMP_DIR, "extract");
let REMIX_SCOPE_DIR = join(VENDOR_DIR, "@remix-run");
let REMIX_PACKAGE_DIR = join(VENDOR_DIR, "remix");
let REMIX_SKILL_DIR = join(SKILLS_DIR, "remix");

interface PackageManifest {
	name: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

async function main() {
	let ref = await resolveRef();

	process.stdout.write(`Vendoring Remix docs from ${ref}\n`);

	await resetTempDir();
	await downloadTarball(ref);
	await extractTarball();

	let repoRoot = await getExtractedRepoRoot();
	let packagesDir = join(repoRoot, "packages");
	let packageDirs = await getPackageDirs(packagesDir);

	await resetVendorDirs();

	for (let packageDir of packageDirs) {
		await copyPackageDocs(packageDir);
	}

	await copyRemixSkill(repoRoot);
}

/**
 * Resolves the ref to vendor from: the tag for the pinned Remix release, or the
 * `--ref <ref>` argument to read a branch such as `main` when you want docs for
 * behavior that has yet to ship.
 */
async function resolveRef() {
	let args = process.argv.slice(2);
	let index = args.indexOf("--ref");
	let override = index === -1 ? undefined : args[index + 1];

	if (override) return override;

	return `remix@${await getPinnedRemixVersion()}`;
}

/**
 * Reads the Remix version the workspaces pin, rejecting a split so a partial
 * upgrade cannot vendor docs for a release most of the repository is not on.
 */
async function getPinnedRemixVersion() {
	let versions = new Set<string>();

	for (let folder of ["apps", "packages"]) {
		let directory = join(ROOT_DIR, folder);
		let entries = await readdir(directory, { withFileTypes: true });

		for (let entry of entries) {
			if (!entry.isDirectory()) continue;

			let manifestPath = join(directory, entry.name, "package.json");
			if (!(await pathExists(manifestPath))) continue;

			let manifest = await readManifest(manifestPath);

			for (let field of DEPENDENCY_FIELDS) {
				let version = manifest[field]?.remix;
				if (version) versions.add(version);
			}
		}
	}

	if (versions.size === 0) {
		throw new Error("Found no workspace pinning remix, so there is no release to vendor");
	}

	if (versions.size > 1) {
		let pinned = [...versions].sort().join(", ");
		throw new Error(`Workspaces pin different remix versions: ${pinned}`);
	}

	return [...versions][0]!;
}

async function resetTempDir() {
	await rm(TEMP_DIR, { recursive: true, force: true });
	await mkdir(EXTRACT_DIR, { recursive: true });
}

async function downloadTarball(ref: string) {
	let response = await fetch(`${REMIX_TARBALL_BASE}/${encodeURIComponent(ref)}`, {
		headers: {
			"user-agent": "sergiodxa-monorepo-remix-vendor-updater",
			accept: "application/vnd.github+json",
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to download Remix tarball for ${ref}: ${response.status} ${response.statusText}`,
		);
	}

	let bytes = await response.bytes();
	await writeFile(TAR_PATH, bytes);
}

async function extractTarball() {
	await $`tar -xzf ${TAR_PATH} -C ${EXTRACT_DIR}`;
}

/**
 * Returns the extracted repository root inside GitHub's tarball wrapper folder.
 */
async function getExtractedRepoRoot() {
	let entries = await readdir(EXTRACT_DIR);

	if (entries.length !== 1) {
		throw new Error(`Expected one extracted repository folder, found ${entries.length}`);
	}

	return join(EXTRACT_DIR, entries[0]!);
}

async function getPackageDirs(packagesDir: string) {
	let entries = await readdir(packagesDir, { withFileTypes: true });
	let packageDirs: Array<string> = [];

	for (let entry of entries) {
		if (!entry.isDirectory()) continue;
		packageDirs.push(join(packagesDir, entry.name));
	}

	return packageDirs.sort();
}

async function resetVendorDirs() {
	await rm(REMIX_SCOPE_DIR, { recursive: true, force: true });
	await rm(REMIX_PACKAGE_DIR, { recursive: true, force: true });
	await removeLegacyRemixPackageDirs();
	await mkdir(VENDOR_DIR, { recursive: true });
	await mkdir(REMIX_SCOPE_DIR, { recursive: true });
}

async function copyRemixSkill(repoRoot: string) {
	let sourceDir = join(repoRoot, "template", ".agents", "skills", "remix");
	let hasSkill = await isDirectory(sourceDir);

	if (!hasSkill) return;

	await mkdir(SKILLS_DIR, { recursive: true });
	await rm(REMIX_SKILL_DIR, { recursive: true, force: true });
	await cp(sourceDir, REMIX_SKILL_DIR, { recursive: true });

	process.stdout.write(`Updated ${relativeSkillPath(REMIX_SKILL_DIR)}\n`);
}

async function copyPackageDocs(packageDir: string) {
	let manifestPath = join(packageDir, "package.json");
	let readmePath = join(packageDir, "README.md");
	let docsPath = join(packageDir, "docs");
	let manifest = await readManifest(manifestPath);
	let destinationDir = join(VENDOR_DIR, manifest.name);
	let hasReadme = await pathExists(readmePath);
	let hasDocs = await isDirectory(docsPath);

	if (!hasReadme && !hasDocs) return;

	await mkdir(destinationDir, { recursive: true });

	if (hasReadme) {
		await cp(readmePath, join(destinationDir, "README.md"));
	}

	if (hasDocs) {
		await cp(docsPath, join(destinationDir, "docs"), { recursive: true });
	}

	process.stdout.write(`Updated ${relativeVendorPath(destinationDir)}\n`);
}

/**
 * Removes legacy version-suffixed Remix package folders.
 */
async function removeLegacyRemixPackageDirs() {
	let entries = await readdir(VENDOR_DIR, { withFileTypes: true }).catch(() => []);

	for (let entry of entries) {
		if (!entry.isDirectory()) continue;
		if (!entry.name.startsWith("remix@")) continue;
		await rm(join(VENDOR_DIR, entry.name), { recursive: true, force: true });
	}
}

async function readManifest(filePath: string) {
	let content = await readFile(filePath, "utf8");
	return JSON.parse(content) as PackageManifest;
}

async function pathExists(filePath: string) {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

async function isDirectory(filePath: string) {
	try {
		let info = await stat(filePath);
		return info.isDirectory();
	} catch {
		return false;
	}
}

function relativeVendorPath(filePath: string) {
	let relativePath = filePath.slice(dirname(VENDOR_DIR).length + 1);
	return relativePath || basename(filePath);
}

function relativeSkillPath(filePath: string) {
	let relativePath = filePath.slice(dirname(SKILLS_DIR).length + 1);
	return relativePath || basename(filePath);
}

await main();
