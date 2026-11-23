/**
 * Writes `resources/generated/showcase-usage.json`, the `@sdxc/*` packages and `@sdxc/ui`
 * entries each showcase item imports; `showcase-shots.json`, every screenshot's pixel size; and
 * `showcase-cards.json`, what each item's social card draws. Run after the catalogue extractor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Markdown } from "@sdxc/markdown";
import { decode } from "@sdxc/png";
import { color } from "@sdxc/raster";
import { isFailure } from "@sdxc/result";

import type { KindFacts, ShowcaseCategory } from "~/app/services/showcase-kinds";
import type { SocialCard } from "~/app/services/social-card";
import type { RGB } from "~/scripts/showcase-cards";
import type { CatalogueEntry, ImageSize, ShowcaseUsage } from "~/scripts/showcase-usage";

import { CASE_STUDY_FRONTMATTER } from "~/app/services/case-study-schema";
import { kindChips } from "~/app/services/showcase-kinds";
import { APPLICATIONS, PRODUCTION_LANDINGS } from "~/resources/content/apps";
import { readPalette } from "~/scripts/showcase-cards";
import { collectUsage, readImports, readWebpSize } from "~/scripts/showcase-usage";

/** The app's own root, which every path below is resolved against. */
const APP = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where the document is written, and where the site reads it from. */
const OUTPUT = join(APP, "resources", "generated", "showcase-usage.json");

/** Where every screenshot's size is written, keyed by the address it is served at. */
const SHOTS_OUTPUT = join(APP, "resources", "generated", "showcase-shots.json");

/** Where each item's social-card facts are written, keyed by slug. */
const CARDS_OUTPUT = join(APP, "resources", "generated", "showcase-cards.json");

/** The case studies, whose front matter names each card's title and tagline. */
const CASE_STUDIES = join(APP, "resources", "content", "showcase");

/** The screenshots' folder, one subfolder per item, served from `/showcase/`. */
const SHOTS = join(APP, "public", "showcase");

/**
 * The folders holding each kind of demo, one subfolder per demo named by its slug, with the
 * shared files that draw every demo of that kind around its own: a docs site's shell, pages
 * and feedback, and an app's document.
 */
const DEMO_ROOTS: Array<{ folder: string; shared: string[]; category: ShowcaseCategory }> = [
	{ folder: "demos", shared: [], category: "landing" as const },
	{
		folder: "demo-docs",
		shared: ["shell.tsx", "pages.tsx", "feedback.tsx"],
		category: "docs" as const,
	},
	{ folder: "demo-apps", shared: ["document.tsx"], category: "app" as const },
].map(({ category, folder, shared }) => {
	let root = join(APP, "resources", "views", folder);
	return { folder: root, shared: shared.map((file) => join(root, file)), category };
});

/** The folders of an application that hold the code it ships. */
const APPLICATION_FOLDERS = ["app", "bootstrap", "config", "database", "resources", "routes"];

/**
 * The site's own folders a demo's imports are followed into: the shared shells and parts a
 * demo is drawn with. Services and routes are the site's plumbing, so they are left out.
 */
const FOLLOWED = ["resources/views", "resources/components"].map((path) => join(APP, path));

/**
 * The folders of an application a production landing's imports are followed into: its views,
 * parts, layout, copy and listing. The application's document shell draws every page it
 * serves, so it is left out and the landing names only what it is built from.
 */
const LANDING_FOLLOWED = ["resources", "config"];

/** The application-wide document shell, left out of a landing's own files. */
const LANDING_SHELL = "resources/layouts/document.tsx";

/** Where `~/` resolves, which folders an import is followed into, and which files never are. */
interface FollowScope {
	root: string;
	followed: string[];
	skipped: string[];
}

/** The site's own scope, which a demo's imports are followed within. */
const SITE_SCOPE: FollowScope = { root: APP, followed: FOLLOWED, skipped: [] };

await main();

/** Reads the catalogue, walks every item's source and writes the document. */
async function main(): Promise<void> {
	let catalogue = readCatalogue();
	let usage: Record<string, ShowcaseUsage> = {};
	let kinds: Record<string, KindFacts> = {};

	for (let application of APPLICATIONS) {
		let root = join(APP, "..", application.directory);
		let files = APPLICATION_FOLDERS.flatMap((folder) => listSources(join(root, folder)));
		usage[application.directory] = collectUsage(files.map(read), catalogue);
		kinds[application.directory] = {
			kind: "production",
			category: "app",
			live: application.href !== null,
		};
	}

	for (let landing of PRODUCTION_LANDINGS) {
		let root = join(APP, "..", landing.application);
		let scope = {
			root,
			followed: LANDING_FOLLOWED.map((folder) => join(root, folder)),
			skipped: [join(root, LANDING_SHELL)],
		};
		let files = followImports(listSources(join(root, landing.folder)), scope);
		usage[landing.slug] = collectUsage([...files].map(read), catalogue);
		kinds[landing.slug] = { kind: "production", category: "landing", live: true };
	}

	for (let root of DEMO_ROOTS) {
		for (let slug of readdirSync(root.folder)) {
			let folder = join(root.folder, slug);
			if (!statSync(folder).isDirectory() || !existsSync(join(folder, "index.tsx"))) continue;
			let files = followImports([...listSources(folder), ...root.shared]);
			usage[slug] = collectUsage([...files].map(read), catalogue);
			kinds[slug] = { kind: "demo", category: root.category, live: true };
		}
	}

	mkdirSync(dirname(OUTPUT), { recursive: true });
	writeFileSync(OUTPUT, `${JSON.stringify({ usage }, null, "\t")}\n`);
	writeFileSync(SHOTS_OUTPUT, `${JSON.stringify({ sizes: readShotSizes() }, null, "\t")}\n`);
	let cards = await readCards(kinds);
	writeFileSync(CARDS_OUTPUT, `${JSON.stringify({ cards }, null, "\t")}\n`);
}

/**
 * Each item's social-card facts: its name and tagline from the case study, its chips, and the
 * palette read from its `card.png`. The version is that image's hash, so a re-shot cover
 * changes the card's address and platforms fetch it again. An item with no case study or no
 * card image is left out, and its page keeps the site's own card.
 */
async function readCards(
	kinds: Record<string, KindFacts>,
): Promise<Record<string, SocialCard.ShowcaseFacts>> {
	let cards: Record<string, SocialCard.ShowcaseFacts> = {};
	for (let [slug, facts] of Object.entries(kinds).sort(([a], [b]) => a.localeCompare(b))) {
		let study = join(CASE_STUDIES, `${slug}.md`);
		let source = join(SHOTS, slug, "card.png");
		if (!existsSync(study) || !existsSync(source)) continue;
		let parsed = Markdown.frontmatter(read(study), { frontmatter: CASE_STUDY_FRONTMATTER });
		if (isFailure(parsed)) continue;
		let bytes = readFileSync(source);
		let image = await decode(bytes);
		if (isFailure(image)) continue;
		let { accent, tagline, title } = parsed.data.frontmatter;
		cards[slug] = {
			title,
			tagline,
			chips: kindChips(facts),
			source: `/showcase/${slug}/card.png`,
			version: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
			...readPalette(image.data, accent === undefined ? undefined : channels(accent)),
		};
	}
	return cards;
}

/** A CSS colour as 0–255 sRGB channels. */
function channels(value: string): RGB {
	let parsed = color(value);
	return [parsed.r * 255, parsed.g * 255, parsed.b * 255];
}

/** Every screenshot's size, keyed by its address, such as `/showcase/keel/hero.webp`. */
function readShotSizes(): Record<string, ImageSize> {
	let sizes: Record<string, ImageSize> = {};
	if (!existsSync(SHOTS)) return sizes;
	for (let path of readdirSync(SHOTS, { recursive: true, encoding: "utf8" }).sort()) {
		if (!path.endsWith(".webp")) continue;
		let size = readWebpSize(readFileSync(join(SHOTS, path)));
		if (size !== null) sizes[`/showcase/${path.split("\\").join("/")}`] = size;
	}
	return sizes;
}

/** Every page under `/api/ui`, from the documents the catalogue extractor wrote. */
function readCatalogue(): CatalogueEntry[] {
	let generated = join(APP, "resources", "generated");
	let components = JSON.parse(read(join(generated, "components.json"))) as {
		entries: Array<{ name: string; slug: string; module: string }>;
	};
	let exports = JSON.parse(read(join(generated, "ui-exports.json"))) as {
		entries: Record<
			string,
			Array<{ name: string; subpath: string; slug: string; namespace?: string }>
		>;
	};
	return [
		...components.entries.map((entry) => ({
			name: entry.name,
			path: entry.slug,
			module: entry.module,
		})),
		...Object.values(exports.entries)
			.flat()
			.map((entry) => ({
				name: entry.name,
				path: `${entry.subpath}/${entry.slug}`,
				module: entry.namespace ?? "components",
			})),
	];
}

/** Every TypeScript module under a folder, tests left out, since they ship nothing. */
function listSources(folder: string): string[] {
	if (!existsSync(folder)) return [];
	return readdirSync(folder, { recursive: true, encoding: "utf8" })
		.filter(
			(path) =>
				/\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.includes("node_modules"),
		)
		.map((path) => join(folder, path));
}

/**
 * The files an item is drawn from: its own folder, plus every shared shell or part those files
 * import from inside the scope, followed until nothing new turns up.
 */
function followImports(start: string[], scope: FollowScope = SITE_SCOPE): Set<string> {
	let seen = new Set(start);
	let queue = [...start];
	while (queue.length > 0) {
		let file = queue.pop();
		if (file === undefined) break;
		for (let record of readImports(read(file))) {
			let target = resolveImport(file, record.specifier, scope);
			if (target === null || seen.has(target)) continue;
			seen.add(target);
			queue.push(target);
		}
	}
	return seen;
}

/** The file an import names, when it is one inside the scope an item is drawn with. */
function resolveImport(from: string, specifier: string, scope: FollowScope): string | null {
	let base: string | null = null;
	if (specifier.startsWith("~/")) base = join(scope.root, specifier.slice(2));
	else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
	if (base === null || !scope.followed.some((folder) => base.startsWith(folder))) return null;
	for (let candidate of [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		join(base, "index.ts"),
		join(base, "index.tsx"),
	]) {
		if (scope.skipped.includes(candidate)) return null;
		if (/\.tsx?$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile()) {
			return candidate;
		}
	}
	return null;
}

/** A file's text. */
function read(path: string): string {
	return readFileSync(path, "utf8");
}
