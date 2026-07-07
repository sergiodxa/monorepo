/**
 * The typed asset registry and eager loader for the presentation.
 *
 * A single manifest enumerates every image, audio clip, map, and sprite atlas the
 * game can use; the store loads them all at boot (the game is small enough for
 * eager loading) and hands out decoded handles by id. Missing files are tolerated
 * so the game still runs before real art and audio exist: image, audio, and atlas
 * getters return `null` for ids that failed or were never declared, and rendering
 * code falls back to procedural drawing. A manifest id that was declared but is
 * asked for the wrong kind throws, because that is a programming error, not
 * missing art.
 *
 * An atlas entry pairs an image URL with a named-region map (and optional animated
 * regions); once its image decodes the store assembles an `Atlas` and exposes it
 * by id, so renderers blit by region name without knowing whether the art came
 * from a file or was generated in code. Only original or openly-licensed art may
 * be declared — never the ripped commercial sheets that sit in `assets/`.
 *
 * A map entry is either a URL (fetched) or the map JSON inlined as an object;
 * either way the store validates it through the map loader before registering it,
 * so a malformed map is logged and skipped rather than crashing the renderer.
 * Inlining is the reliable form under the Bun HTML dev server (see the `maps`
 * field doc), which is why authored maps ship as imported JSON modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@pkg/result";

import type { AtlasAnimation, Rect } from "../render/atlas";
import type { TileMap } from "../render/tilemap";

import { loadMap } from "../overworld/map-loader";
import { Atlas, type AtlasSource } from "../render/atlas";

/** One atlas declaration: an image URL sliced into named (and animated) regions. */
export interface AtlasManifestEntry {
	/** URL of the sheet image sliced into regions. */
	image: string;
	/** Static regions keyed by name, in source pixels. */
	regions: Record<string, Rect>;
	/** Optional animated regions keyed by name. */
	animations?: Record<string, AtlasAnimation>;
}

/** Enumerates every asset the game may load, grouped by kind. */
export interface AssetManifest {
	/** Image id to URL: sprite sheets, tilesets, windowskin, backgrounds. */
	images: Record<string, string>;
	/** Audio id to URL plus optional intro/loop points, in seconds. */
	audio: Record<string, { url: string; loopStart?: number; loopEnd?: number }>;
	/**
	 * Map id to its tilemap source: either a URL string (fetched at boot) or the
	 * map JSON inlined as an object. Inlining is the reliable path under the Bun
	 * HTML dev server, whose SPA fallback returns the app shell for any unknown URL
	 * rather than the file — so a runtime `fetch` of a content JSON path would get
	 * HTML, not the map. Authored maps therefore ship as imported JSON modules
	 * inlined here; the URL form is kept for a future real static file server.
	 */
	maps: Record<string, string | object>;
	/** Atlas id to its image URL and region map (optional; defaults to empty). */
	atlases?: Record<string, AtlasManifestEntry>;
}

/** Eagerly loads and hands out every asset named by a manifest. */
export class AssetStore {
	/** Decoded images by manifest id (absent when a load failed). */
	private readonly images = new Map<string, HTMLImageElement>();

	/** Decoded audio buffers by manifest id (absent when a load failed). */
	private readonly audioBuffers = new Map<string, AudioBuffer>();

	/** Loop-point metadata by audio id, forwarded from the manifest. */
	private readonly audioLoops = new Map<string, { loopStart?: number; loopEnd?: number }>();

	/** Parsed tilemaps by manifest id (absent when a load failed). */
	private readonly maps = new Map<string, TileMap>();

	/** Assembled atlases by manifest id (absent when the image failed to load). */
	private readonly atlases = new Map<string, Atlas>();

	/** @param manifest - The full set of assets to load at boot. */
	constructor(private readonly manifest: AssetManifest) {}

	/**
	 * Loads every asset in the manifest, reporting progress as items settle.
	 *
	 * Individual failures are swallowed (a warning is logged) so a missing file
	 * never blocks boot; callers detect absence through the nullable getters.
	 */
	async loadAll(
		onProgress: (loaded: number, total: number) => void,
		audioContext?: AudioContext,
	): Promise<void> {
		let imageEntries = Object.entries(this.manifest.images);
		let audioEntries = Object.entries(this.manifest.audio);
		let mapEntries = Object.entries(this.manifest.maps);
		let atlasEntries = Object.entries(this.manifest.atlases ?? {});
		let total = imageEntries.length + audioEntries.length + mapEntries.length + atlasEntries.length;
		let loaded = 0;
		let step = () => onProgress(++loaded, total);

		if (total === 0) return onProgress(0, 0);

		let tasks: Promise<void>[] = [];

		for (let [id, url] of imageEntries) {
			tasks.push(
				this.loadImage(url)
					.then((image) => void this.images.set(id, image))
					.catch((error) => console.warn(`Failed to load image "${id}":`, error))
					.finally(step),
			);
		}

		for (let [id, entry] of audioEntries) {
			this.audioLoops.set(id, { loopStart: entry.loopStart, loopEnd: entry.loopEnd });
			tasks.push(
				this.loadAudio(entry.url, audioContext)
					.then((buffer) => {
						if (buffer) this.audioBuffers.set(id, buffer);
					})
					.catch((error) => console.warn(`Failed to load audio "${id}":`, error))
					.finally(step),
			);
		}

		for (let [id, source] of mapEntries) {
			tasks.push(
				this.resolveMapSource(source)
					.then((value) => this.registerMap(id, value))
					.catch((error) => console.warn(`Failed to load map "${id}":`, error))
					.finally(step),
			);
		}

		for (let [id, entry] of atlasEntries) {
			tasks.push(
				this.loadImage(entry.image)
					.then((image) => {
						this.atlases.set(
							id,
							new Atlas(image as unknown as AtlasSource, entry.regions, entry.animations ?? {}),
						);
					})
					.catch((error) => console.warn(`Failed to load atlas "${id}":`, error))
					.finally(step),
			);
		}

		await Promise.all(tasks);
	}

	/** Returns the loaded image for an id, or null when it is missing. */
	image(id: string): HTMLImageElement | null {
		return this.images.get(id) ?? null;
	}

	/** Returns the decoded audio buffer for an id, or null when it is missing. */
	audioBuffer(id: string): AudioBuffer | null {
		return this.audioBuffers.get(id) ?? null;
	}

	/** Returns the intro/loop points for an audio id, if any were declared. */
	audioLoopPoints(id: string): { loopStart?: number; loopEnd?: number } {
		return this.audioLoops.get(id) ?? {};
	}

	/** Returns the parsed tilemap for an id, or null when it is missing. */
	map(id: string): TileMap | null {
		return this.maps.get(id) ?? null;
	}

	/** Returns the assembled atlas for an id, or null when it is missing. */
	atlas(id: string): Atlas | null {
		return this.atlases.get(id) ?? null;
	}

	/**
	 * Resolves a manifest map source to its parsed JSON value.
	 *
	 * An inline object is used as-is (an imported JSON module, the reliable path
	 * under the Bun HTML dev server); a string is treated as a URL and fetched.
	 */
	private async resolveMapSource(source: string | object): Promise<unknown> {
		if (typeof source !== "string") return source;
		let response = await fetch(source);
		return await response.json();
	}

	/**
	 * Validates a map JSON value and registers it under an id.
	 *
	 * The value runs through {@link loadMap}, so a malformed map is logged and
	 * skipped (its getter then returns null and the overworld falls back), never
	 * registering a broken map that would crash the renderer.
	 */
	private registerMap(id: string, value: unknown) {
		let result = loadMap(value);
		if (isFailure(result)) {
			console.warn(`Invalid map "${id}": ${result.error.message}`);
			return;
		}
		this.maps.set(id, result.data);
	}

	/** Decodes one image URL into an element. */
	private loadImage(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			let image = new Image();
			image.addEventListener("load", () => resolve(image));
			image.addEventListener("error", () => reject(new Error(`Image error: ${url}`)));
			image.src = url;
		});
	}

	/** Fetches and decodes one audio URL, or resolves null without a context. */
	private async loadAudio(url: string, context?: AudioContext): Promise<AudioBuffer | null> {
		if (!context) return null;
		let response = await fetch(url);
		let bytes = await response.arrayBuffer();
		return await context.decodeAudioData(bytes);
	}
}
