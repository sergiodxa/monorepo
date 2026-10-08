/**
 * Runs epubcheck over every golden `.epub` under `src/fixtures` and fails on any error or
 * warning, which is the authoritative check behind the package's own verification. It uses a
 * local Java when one runs and a JRE container otherwise, so a machine needs one of the two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { unzipSync } from "fflate";

/** The epubcheck release the fixtures are held to; raising it is a deliberate change. */
const VERSION = "5.4.0";

/** The release archive on GitHub, which holds the jar and its `lib/` folder. */
const RELEASE_URL = `https://github.com/w3c/epubcheck/releases/download/v${VERSION}/epubcheck-${VERSION}.zip`;

/** Where the extracted release is kept between runs; `.cache/` is ignored by git. */
const CACHE = path.join(import.meta.dirname, "../.cache/epubcheck");

/** The golden publications the tests compare byte for byte. */
const FIXTURES = path.join(import.meta.dirname, "../src/fixtures");

/** The JRE image used when no local Java runs, pinned to a major version. */
const JRE_IMAGE = "eclipse-temurin:21-jre";

/**
 * Downloads and extracts the release once, answering the jar's directory, or an error message
 * when the download fails.
 */
async function install(): Promise<{ directory: string } | { error: string }> {
	let directory = path.join(CACHE, `epubcheck-${VERSION}`);
	if (existsSync(path.join(directory, "epubcheck.jar"))) return { directory };

	process.stderr.write(`Downloading epubcheck ${VERSION}…\n`);
	let response = await fetch(RELEASE_URL);
	if (!response.ok) return { error: `Could not download ${RELEASE_URL}: HTTP ${response.status}` };

	let files = unzipSync(new Uint8Array(await response.arrayBuffer()));
	for (let [name, bytes] of Object.entries(files)) {
		if (name.endsWith("/")) continue;
		let target = path.resolve(CACHE, name);
		if (!target.startsWith(`${CACHE}${path.sep}`)) continue;
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, bytes);
	}
	return { directory };
}

/** Whether `java -version` runs, which the macOS stub without a JDK fails. */
function hasJava(): boolean {
	return spawnSync("java", ["-version"], { stdio: "ignore" }).status === 0;
}

/**
 * Checks every fixture, printing epubcheck's report for each, and sets a non-zero exit code
 * when any publication has an error or warning, or when no checker could run.
 */
async function main() {
	let epubs = readdirSync(FIXTURES)
		.filter((name) => name.endsWith(".epub"))
		.sort();
	if (epubs.length === 0) {
		process.stderr.write(`No .epub fixtures under ${FIXTURES}\n`);
		process.exitCode = 1;
		return;
	}

	let installed = await install();
	if ("error" in installed) {
		process.stderr.write(`${installed.error}\n`);
		process.exitCode = 1;
		return;
	}

	let local = hasJava();
	for (let epub of epubs) {
		let args = local
			? ["java", "-jar", path.join(installed.directory, "epubcheck.jar"), path.join(FIXTURES, epub)]
			: [
					"docker",
					"run",
					"--rm",
					"-v",
					`${installed.directory}:/epubcheck:ro`,
					"-v",
					`${FIXTURES}:/fixtures:ro`,
					JRE_IMAGE,
					"java",
					"-jar",
					"/epubcheck/epubcheck.jar",
					`/fixtures/${epub}`,
				];
		let [command = "java", ...rest] = args;
		let result = spawnSync(command, [...rest, "--failonwarnings"], { stdio: "inherit" });
		if (result.error) {
			process.stderr.write(`Could not run ${command}: ${result.error.message}\n`);
			process.exitCode = 1;
			return;
		}
		if (result.status !== 0) process.exitCode = 1;
	}
}

await main();
