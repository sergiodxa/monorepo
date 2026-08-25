/**
 * Refreshes the checked-in content snapshot under `apps/pkmn/json/pokeapi-v2`
 * from the upstream `api-data` archive, so the content data layer reads stable
 * local JSON files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import console from "node:console";
import { cp, mkdtemp, readdir, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let logger = console;

let scriptDirectory = dirname(fileURLToPath(import.meta.url));
let appDirectory = resolve(scriptDirectory, "..");
let outputDirectory = join(appDirectory, "json", "pokeapi-v2");
let archiveUrl = "https://codeload.github.com/PokeAPI/api-data/tar.gz/refs/heads/master";

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(join(appDirectory, "json"), { recursive: true });

let temporaryDirectory = await mkdtemp(join(tmpdir(), "pkmn-pokeapi-"));
let archivePath = join(temporaryDirectory, "api-data.tar.gz");

try {
	logger.info("Downloading PokeAPI v2 data snapshot", {
		archive_url: archiveUrl,
		output_directory: outputDirectory,
	});

	let response = await fetch(archiveUrl);

	logger.info("Download completed, saving archive to disk", {
		archive_path: archivePath,
	});

	if (!response.ok || !response.body) {
		logger.error("Failed to download archive", {
			status: response.status,
			statusText: response.statusText,
		});
		process.exit(1);
	}

	let archive = await response.bytes();
	await Bun.write(archivePath, archive);

	logger.info("Archive saved to disk", {
		archive_path: archivePath,
	});

	let extraction = Bun.spawn(["tar", "-xzf", archivePath, "-C", temporaryDirectory], {
		stdout: "inherit",
		stderr: "inherit",
	});
	let extractionExitCode = await extraction.exited;
	if (extractionExitCode !== 0) {
		logger.error("Failed to extract archive", { exit_code: extractionExitCode });
		process.exit(1);
	}

	let extractedEntries = await readdir(temporaryDirectory, { withFileTypes: true });
	let repositoryDirectory = extractedEntries.find(
		(entry) => entry.isDirectory() && entry.name.startsWith("api-data-"),
	);

	if (!repositoryDirectory) {
		logger.error("Could not locate extracted api-data repository root.");
		process.exit(1);
	}

	let sourceDirectory = join(temporaryDirectory, repositoryDirectory.name, "data", "api", "v2");
	await cp(sourceDirectory, outputDirectory, { recursive: true });

	logger.info("PokeAPI v2 data snapshot downloaded", {
		source_directory: sourceDirectory,
		output_directory: outputDirectory,
	});
} finally {
	await rm(temporaryDirectory, { recursive: true, force: true });
}
