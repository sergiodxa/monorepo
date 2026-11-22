/**
 * Captures every screenshot a case study's front matter lists into `public/showcase/<slug>/`,
 * from a running `vp preview` build, as WebP in light (`<id>.webp`) and dark (`<id>-dark.webp`).
 * A `highlight` selector dims the page around that element and crops to it with some context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "playwright";

import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";
import { chromium } from "playwright";

import type { CaseStudyShot } from "~/app/services/case-study-schema";

import { CASE_STUDY_FRONTMATTER } from "~/app/services/case-study-schema";
import { APPLICATIONS, PRODUCTION_LANDINGS } from "~/resources/content/apps";

/** The app's own root. */
const APP = dirname(dirname(fileURLToPath(import.meta.url)));

/** Where the case studies are read from and the shots written to. */
const CONTENT = join(APP, "resources", "content", "showcase");
const OUTPUT = join(APP, "public", "showcase");

/** The production build `vp preview` serves, which the demos are captured from; `SHOWCASE_ORIGIN` points elsewhere. */
const ORIGIN = process.env.SHOWCASE_ORIGIN ?? "http://localhost:4317";

/** The two viewports a shot is taken at, at one and a half times the pixels so a crop stays sharp. */
const VIEWPORTS = {
	desktop: { width: 1440, height: 900 },
	phone: { width: 390, height: 844 },
} as const;

/** How much of the page around a highlighted element a crop keeps, in CSS pixels. */
const CONTEXT = 64;

/** Each color scheme a shot is taken in, with the suffix its file carries. */
const SCHEMES = { light: "", dark: "-dark" } as const;

/** One of {@link SCHEMES}. */
type Scheme = keyof typeof SCHEMES;

await main(process.argv.slice(2));

/**
 * Captures the slugs named on the command line, or every case study, in both schemes;
 * `--scheme=dark` or `--scheme=light` takes one.
 */
async function main(args: string[]): Promise<void> {
	let only = args.filter((arg) => !arg.startsWith("--"));
	let asked = args.find((arg) => arg.startsWith("--scheme="))?.slice("--scheme=".length);
	let schemes = (Object.keys(SCHEMES) as Scheme[]).filter(
		(scheme) => asked === undefined || scheme === asked,
	);
	let slugs = readdirSync(CONTENT)
		.filter((file) => file.endsWith(".md"))
		.map((file) => file.slice(0, -".md".length))
		.filter((slug) => only.length === 0 || only.includes(slug));

	let browser = await chromium.launch();
	let failures: string[] = [];
	try {
		for (let slug of slugs) {
			let parsed = Markdown.frontmatter(readFileSync(join(CONTENT, `${slug}.md`), "utf8"), {
				frontmatter: CASE_STUDY_FRONTMATTER,
			});
			if (isFailure(parsed)) {
				failures.push(`${slug}: ${parsed.error.message}`);
				continue;
			}
			mkdirSync(join(OUTPUT, slug), { recursive: true });
			for (let [shot, scheme] of parsed.data.frontmatter.shots.flatMap((entry) =>
				schemes.map((name) => [entry, name] as const),
			)) {
				let viewport = VIEWPORTS[shot.viewport ?? "desktop"];
				let context = await browser.newContext({
					viewport,
					deviceScaleFactor: 1.5,
					colorScheme: scheme,
					reducedMotion: "reduce",
					isMobile: shot.viewport === "phone",
					hasTouch: shot.viewport === "phone",
				});
				let page = await context.newPage();
				try {
					let file = `${shot.id}${SCHEMES[scheme]}.webp`;
					await capture(page, slug, shot, join(OUTPUT, slug, file));
					console.info(`${slug}/${file}`);
				} catch (error) {
					failures.push(
						`${slug}/${shot.id} (${scheme}): ${error instanceof Error ? error.message : String(error)}`,
					);
				} finally {
					await context.close();
				}
			}
		}
	} finally {
		await browser.close();
	}
	if (failures.length > 0) {
		console.error(`\n${failures.length} shot(s) failed:\n${failures.join("\n")}`);
		process.exitCode = 1;
	}
}

/** The address a shot opens: a production app's own URL, or the demo's page under the showcase. */
function addressOf(slug: string, shot: CaseStudyShot): string {
	if (
		APPLICATIONS.some((application) => application.directory === slug) ||
		PRODUCTION_LANDINGS.some((landing) => landing.slug === slug) ||
		/^https?:/.test(shot.page)
	) {
		return shot.page;
	}
	let [path = "", rest = ""] = shot.page.split(/(?=[?#])/, 2);
	let base = `${ORIGIN}/showcase/${slug}/demo${path === "" ? "" : `/${path}`}`;
	return `${base}${rest}`;
}

/** Opens the shot's page, runs its click, and writes the viewport or the highlighted crop to `path`. */
async function capture(page: Page, slug: string, shot: CaseStudyShot, path: string): Promise<void> {
	/** A live site that keeps a connection open never goes idle, so its `load` event is enough. */
	let address = addressOf(slug, shot);
	await page
		.goto(address, { waitUntil: "networkidle", timeout: 20_000 })
		.catch(async () => await page.goto(address, { waitUntil: "load", timeout: 60_000 }));
	await page.addStyleTag({
		content: "*, *::before, *::after { caret-color: transparent !important; }",
	});
	if (shot.click !== undefined) {
		await page.locator(shot.click).first().click();
		await page.waitForTimeout(400);
	}
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(shot.wait ?? 600);

	if (shot.highlight === undefined) {
		toWebp(await page.screenshot({ type: "png" }), path);
		return;
	}

	let target = page.locator(shot.highlight).first();
	await target.scrollIntoViewIfNeeded();
	await page.waitForTimeout(300);
	let box = await target.boundingBox();
	if (box === null) throw new Error(`${shot.highlight} is not visible`);

	/**
	 * The ring goes into the top-layer element that holds the target, an open modal dialog or
	 * popover, when there is one, since nothing outside the top layer draws above it.
	 */
	await target.evaluate((element, { x, y, width, height }) => {
		let layer = element.closest("dialog[open], :popover-open");
		let spot = document.createElement("div");
		Object.assign(spot.style, {
			position: "fixed",
			left: `${x - 6}px`,
			top: `${y - 6}px`,
			width: `${width + 12}px`,
			height: `${height + 12}px`,
			margin: "0",
			borderRadius: "12px",
			boxShadow: "0 0 0 3px oklch(0.62 0.19 255), 0 0 0 100vmax oklch(0.2 0.02 255 / 0.42)",
			pointerEvents: "none",
			zIndex: "2147483647",
		});
		(layer ?? document.body).appendChild(spot);
	}, box);

	let viewport = page.viewportSize() ?? VIEWPORTS.desktop;
	let x = Math.max(0, box.x - CONTEXT);
	let y = Math.max(0, box.y - CONTEXT);
	let width = Math.min(viewport.width - x, box.width + CONTEXT * 2);
	let height = Math.min(viewport.height - y, box.height + CONTEXT * 2);
	toWebp(await page.screenshot({ type: "png", clip: { x, y, width, height } }), path);
}

/**
 * Encodes a PNG screenshot as WebP with `cwebp`, which keeps a full-viewport shot near a
 * quarter of the size a JPEG of the same look takes. `cwebp` comes with `brew install webp`.
 */
function toWebp(png: Buffer, path: string): void {
	let source = `${path}.png`;
	writeFileSync(source, png);
	try {
		execFileSync("cwebp", ["-quiet", "-q", "70", "-m", "6", source, "-o", path]);
	} finally {
		rmSync(source, { force: true });
	}
}
