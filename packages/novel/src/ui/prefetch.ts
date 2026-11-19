/**
 * Warms what the story can show next while the reader is still in the current scene: on each
 * scene entered it asks the novel for the scenes within reach (which imports their modules) and
 * fetches their files at low priority, so a jump draws and plays without waiting on the network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SceneAsset } from "../links.js";
import type { Novel } from "../novel.js";

import { INTERNALS } from "../novel.js";

import type { AudioMixer } from "./audio.js";

/** Asset kinds warmed by decoding an image. */
const IMAGE_KINDS: ReadonlySet<SceneAsset["kind"]> = new Set<SceneAsset["kind"]>([
	"background",
	"image",
	"character",
]);

/** Asset kinds decoded into the mixer's buffers, the way it plays them. */
const BUFFER_KINDS: ReadonlySet<SceneAsset["kind"]> = new Set<SceneAsset["kind"]>([
	"sound",
	"voice",
]);

/** Files warmed at once; the rest wait their turn. */
const DEFAULT_CONCURRENCY = 4;

/** What a prefetcher reads from the player that owns it. */
export interface PrefetchHost {
	novel(): Novel;
	mixer(): AudioMixer;
}

/**
 * Prefetches the files of the scenes reachable from the one the play entered. Each URL is warmed
 * once per prefetcher; entering another scene drops the files still waiting (those in flight
 * finish), so racing through scenes never queues more than one scene's worth of work.
 */
export class Prefetcher {
	#host: PrefetchHost;
	#concurrency: number;
	#queue: SceneAsset[] = [];
	#active = 0;
	#seen = new Set<string>();
	#links: HTMLLinkElement[] = [];
	#entry = 0;
	#disposed = false;
	/** Every URL started, in order, for a test or a developer panel to read. */
	readonly warmed: string[] = [];

	/**
	 * @param host - The player's novel and mixer.
	 * @param concurrency - How many files warm at once.
	 */
	constructor(host: PrefetchHost, concurrency = DEFAULT_CONCURRENCY) {
		this.#host = host;
		this.#concurrency = Math.max(1, concurrency);
	}

	/**
	 * Starts prefetching for a scene the play entered: the files of every scene within `depth`
	 * jumps, its own included, for the reader's locale. `data:` and `blob:` URLs are skipped.
	 *
	 * @param scene - The scene's name.
	 * @param options - How many jumps to follow and the reader's locale.
	 * @returns Once the reachable scenes are known and their files are queued.
	 */
	async enter(scene: string, options: { depth: number; locale: string }): Promise<void> {
		let entry = ++this.#entry;
		this.#queue = [];
		let declaration = this.#host.novel()[INTERNALS]().scenes.get(scene);
		if (declaration === undefined) return;
		let reached = await this.#host
			.novel()
			.reachable(declaration, options)
			.catch(() => []);
		if (entry !== this.#entry || this.#disposed) return;
		for (let next of reached) {
			for (let asset of next.assets) {
				if (this.#seen.has(asset.url) || /^(data|blob):/.test(asset.url)) continue;
				this.#seen.add(asset.url);
				this.#queue.push(asset);
			}
		}
		this.#pump();
	}

	/** Drops waiting work and removes the prefetch links, when the player leaves the page. */
	dispose(): void {
		this.#disposed = true;
		this.#queue = [];
		for (let link of this.#links) link.remove();
		this.#links = [];
	}

	/** Starts queued files while fewer than the cap are in flight. */
	#pump(): void {
		while (!this.#disposed && this.#active < this.#concurrency) {
			let asset = this.#queue.shift();
			if (asset === undefined) return;
			this.#active += 1;
			this.warmed.push(asset.url);
			void this.#warm(asset).finally(() => {
				this.#active -= 1;
				this.#pump();
			});
		}
	}

	/**
	 * Warms one file the way the player will use it: images decoded, sounds and voices decoded
	 * into the mixer's buffers, and streamed music and ambience left to the browser's cache
	 * through a `prefetch` link. A file that fails to load is left for the play to report.
	 */
	async #warm(asset: SceneAsset): Promise<void> {
		if (IMAGE_KINDS.has(asset.kind)) {
			let image = new Image();
			image.src = asset.url;
			await image.decode().catch(() => undefined);
			return;
		}
		if (BUFFER_KINDS.has(asset.kind)) {
			await this.#host.mixer().preload(asset.url);
			return;
		}
		let link = document.createElement("link");
		link.rel = "prefetch";
		link.href = asset.url;
		document.head.append(link);
		this.#links.push(link);
	}
}
