/**
 * Importer tool view — imports an EXISTING PNG and registers it as an atlas so the
 * game can blit tiles/sprites by region name. Built on the canonical tool-view
 * pattern: local state lives in setup-scope variables, the view re-renders through
 * `handle.update()` on any control change, and there are no framework hooks. A
 * file input decodes the chosen PNG via `createImageBitmap` to learn its
 * dimensions and paint a scaled preview onto a canvas bound with the `ref` mixin;
 * the same canvas overlays the current slicing (a tile grid or the manual region
 * rects) so the author sees exactly what will be written.
 *
 * Two slice modes drive the region map, both computed by the pure
 * `atlas-slicer` helpers (never in the DOM): a TILESET GRID mode (tile width/
 * height plus optional margin/spacing, with the fitting columns/rows derived from
 * the image size and names auto-generated as `tile.N` or `r{row}c{col}`), and a
 * SPRITE ATLAS mode where the author adds/removes/renames named regions by hand
 * (name + x/y/w/h, each drawn on the preview). An atlas id names both the written
 * `src/assets/<id>.png` and the manifest atlas; the Import button POSTs the PNG
 * bytes plus the region map to the importer export action, which writes the file
 * and registers the full atlas.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, on, ref } from "remix/ui";

import type { Rect } from "~/presentation/render/atlas";

/** The raw parameter type of the `css()` mixin, narrowed by {@link Styles}. */
type CssMixinStyles = Parameters<typeof css>[0];

/**
 * The style-object shape the `css()` mixin accepts, used for shared base styles.
 *
 * The mixin's own parameter type is derived from `CSSStyleDeclaration`, so it
 * carries that interface's `Symbol.iterator` member and reads as an iterable.
 * Dropping the symbol keys leaves the same plain property bag the base styles
 * actually are, so they can be spread into an override object.
 */
type Styles = { [K in keyof CssMixinStyles as K extends symbol ? never : K]: CssMixinStyles[K] };

import {
	addRegion,
	type GridNaming,
	type NamedRegion,
	regionsToMap,
	removeRegion,
	renameRegion,
	sliceGrid,
} from "../editors/atlas-slicer";

/** The two ways to slice an imported PNG into atlas regions. */
type SliceMode =
	/** A regular tile grid (tileset / sheet), auto-named row-major. */
	| "grid"
	/** Hand-placed named regions (a sprite atlas). */
	| "manual";

/** Target size in canvas pixels the preview's longest side is scaled to fill. */
const PREVIEW_MAX = 512;

/** Encodes raw bytes as base64 with `btoa`, chunked to survive larger files. */
function bytesToBase64(bytes: Uint8Array): string {
	let CHUNK = 0x8000;
	let binary = "";
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/** Shared base style for the small control buttons. */
const CONTROL_BUTTON: Styles = {
	padding: "0.4rem 0.75rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
	cursor: "pointer",
};

/** Shared base style for text/number inputs and selectors. */
const FIELD: Styles = {
	padding: "0.35rem 0.5rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
};

/** Shared style for the small labels above each control group. */
const LABEL = css({ display: "grid", gap: "0.25rem", fontSize: "0.8rem", color: "#9ca3af" });

/** The indigo accent marking the active control/mode. */
const ACCENT = "#6366f1";

/** The idle border color shared by the small control buttons. */
const IDLE_BORDER = "#3f3f46";

/** Stroke color for the slice overlay drawn over the preview. */
const OVERLAY_STROKE = "rgba(99, 102, 241, 0.9)";

/** Fill tint for manual region rects so hand-placed regions read at a glance. */
const OVERLAY_FILL = "rgba(99, 102, 241, 0.15)";

/**
 * Importer tool. Decodes an imported PNG, previews it with the current slice
 * overlaid, and posts the PNG plus its region map to the importer export action.
 *
 * @param handle Component handle used to schedule re-renders on control changes.
 * @returns The render function for the importer tool.
 */
export function ImporterTool(handle: Handle<Record<string, never>>) {
	// The decoded image and its raw PNG bytes, or null before a file is chosen.
	let bitmap: ImageBitmap | null = null;
	let pngBytes: Uint8Array | null = null;
	let imageWidth = 0;
	let imageHeight = 0;
	let fileName = "";

	// The canvas the preview + overlay are painted onto, bound via `ref`.
	let canvas: HTMLCanvasElement | null = null;

	// Slice state.
	let mode: SliceMode = "grid";
	let atlasId = "";
	let status = "";
	let statusIsError = false;

	// Grid-mode params.
	let tileWidth = 16;
	let tileHeight = 16;
	let margin = 0;
	let spacing = 0;
	let naming: GridNaming = "index";

	// Manual-mode region list plus the draft fields for the "add region" form.
	let regions: NamedRegion[] = [];
	let draftName = "";
	let draftX = 0;
	let draftY = 0;
	let draftW = 16;
	let draftH = 16;

	/** Reports an outcome inline and re-renders. */
	function report(message: string, isError: boolean) {
		status = message;
		statusIsError = isError;
		void handle.update();
	}

	/** The region map for the current mode, computed by the pure slicer. */
	function currentRegions(): Record<string, Rect> {
		if (mode === "grid") {
			return sliceGrid(imageWidth, imageHeight, {
				tileWidth,
				tileHeight,
				margin,
				spacing,
				naming,
			});
		}
		return regionsToMap(regions);
	}

	/**
	 * Paints the decoded image scaled to fit the preview, then overlays every rect
	 * of the current slice. A no-op when no image is loaded or no 2D context is
	 * available.
	 */
	function renderPreview() {
		if (canvas === null) return;
		let context = canvas.getContext("2d");
		if (context === null) return;

		if (bitmap === null || imageWidth === 0 || imageHeight === 0) {
			canvas.width = 1;
			canvas.height = 1;
			context.clearRect(0, 0, 1, 1);
			return;
		}

		// Scale the longest side to PREVIEW_MAX with an integer-ish factor so pixel
		// art stays crisp; the canvas bitmap matches the drawn size so overlay math
		// is a single `scale` multiply.
		let scale = Math.max(1, Math.floor(PREVIEW_MAX / Math.max(imageWidth, imageHeight)));
		let drawWidth = imageWidth * scale;
		let drawHeight = imageHeight * scale;
		canvas.width = drawWidth;
		canvas.height = drawHeight;
		context.imageSmoothingEnabled = false;
		context.clearRect(0, 0, drawWidth, drawHeight);
		context.drawImage(bitmap, 0, 0, drawWidth, drawHeight);

		let map = currentRegions();
		context.lineWidth = 1;
		context.strokeStyle = OVERLAY_STROKE;
		for (let rect of Object.values(map)) {
			let x = rect.x * scale;
			let y = rect.y * scale;
			let w = rect.w * scale;
			let h = rect.h * scale;
			if (mode === "manual") {
				context.fillStyle = OVERLAY_FILL;
				context.fillRect(x, y, w, h);
			}
			context.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
		}
	}

	/** Decodes the chosen PNG, adopts its dimensions, and previews it. */
	async function importFile(file: File) {
		report("Decoding…", false);
		try {
			let bytes = new Uint8Array(await file.arrayBuffer());
			let decoded = await createImageBitmap(new Blob([bytes], { type: file.type || "image/png" }));
			bitmap?.close();
			bitmap = decoded;
			pngBytes = bytes;
			imageWidth = decoded.width;
			imageHeight = decoded.height;
			fileName = file.name;
			// Default a blank atlas id to the file's base name, slugified.
			if (atlasId.trim().length === 0) {
				atlasId = file.name
					.replace(/\.[^.]+$/, "")
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, "");
			}
			renderPreview();
			report(`Loaded ${file.name} (${imageWidth}×${imageHeight}).`, false);
		} catch (error) {
			report(`Import failed: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	}

	/** Switches slice mode and repaints the overlay. */
	function selectMode(next: SliceMode) {
		mode = next;
		renderPreview();
		void handle.update();
	}

	/** Reads a number field, clamped to a non-negative integer, and repaints. */
	function setNumber(assign: (value: number) => void, raw: string) {
		let value = Math.max(0, Math.trunc(Number(raw)));
		assign(Number.isFinite(value) ? value : 0);
		renderPreview();
		void handle.update();
	}

	/** Adds the draft region to the manual list, surfacing a duplicate-name error. */
	function addDraftRegion() {
		let name = draftName.trim();
		if (name.length === 0) {
			report("Enter a region name before adding it.", true);
			return;
		}
		try {
			regions = addRegion(regions, {
				name,
				rect: { x: draftX, y: draftY, w: draftW, h: draftH },
			});
			draftName = "";
			renderPreview();
			report(`Added region "${name}".`, false);
		} catch (error) {
			report(error instanceof Error ? error.message : String(error), true);
		}
	}

	/** Removes a manual region by name and repaints. */
	function removeNamed(name: string) {
		regions = removeRegion(regions, name);
		renderPreview();
		void handle.update();
	}

	/** Renames a manual region, surfacing a collision error inline. */
	function renameNamed(from: string, to: string) {
		let next = to.trim();
		if (next.length === 0 || next === from) return;
		try {
			regions = renameRegion(regions, from, next);
			renderPreview();
			void handle.update();
		} catch (error) {
			report(error instanceof Error ? error.message : String(error), true);
		}
	}

	/** Posts the PNG plus its region map to the importer export action. */
	async function runImport() {
		if (pngBytes === null) {
			report("Choose a PNG before importing.", true);
			return;
		}
		if (atlasId.trim().length === 0) {
			report("Enter an atlas id before importing.", true);
			return;
		}
		let map = currentRegions();
		if (Object.keys(map).length === 0) {
			report("The current slice produced no regions — adjust the tile size or add regions.", true);
			return;
		}

		report("Importing…", false);
		try {
			let response = await fetch("/dev/export/import", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					id: atlasId.trim(),
					pngBase64: bytesToBase64(pngBytes),
					regions: map,
				}),
			});
			let data = (await response.json()) as {
				path?: string;
				url?: string;
				atlasId?: string;
				regions?: string[];
				error?: string;
			};
			if (response.ok) {
				report(
					`Wrote ${data.path} and registered atlas "${data.atlasId}" with ${data.regions?.length ?? 0} region(s).`,
					false,
				);
			} else report(`Import failed: ${data.error ?? response.statusText}`, true);
		} catch (error) {
			report(`Import failed: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	}

	return () => {
		let map = currentRegions();
		let regionCount = Object.keys(map).length;

		return (
			<section mix={css({ display: "grid", gap: "1rem", justifyItems: "start" })}>
				<header mix={css({ display: "grid", gap: "0.25rem" })}>
					<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Importer</h2>
					<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
						Import an existing PNG, slice it into named regions (a tileset grid or a hand-authored
						sprite atlas), then write it to <code>src/assets</code> and register it as an atlas so
						the game can blit tiles/sprites by region name.
					</p>
				</header>

				<label mix={LABEL}>
					PNG file
					<input
						type="file"
						accept="image/png,image/*"
						mix={[
							css({ ...FIELD, width: "16rem" }),
							on<HTMLInputElement, "change">("change", (event) => {
								let input = event.target as HTMLInputElement;
								let file = input.files?.[0];
								if (file) void importFile(file);
								input.value = "";
							}),
						]}
					/>
				</label>

				{fileName ? (
					<p mix={css({ margin: 0, color: "#a1a1aa", fontSize: "0.8rem" })}>
						{fileName} — {imageWidth}×{imageHeight}px
					</p>
				) : null}

				<label mix={LABEL}>
					Atlas id
					<input
						type="text"
						value={atlasId}
						placeholder="world-tiles"
						mix={[
							css({ ...FIELD, width: "16rem" }),
							on<HTMLInputElement, "input">("input", (event) => {
								atlasId = (event.target as HTMLInputElement).value;
							}),
						]}
					/>
				</label>

				<div mix={css({ display: "flex", gap: "0.5rem" })}>
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, borderColor: mode === "grid" ? ACCENT : IDLE_BORDER }),
							on<HTMLButtonElement, "click">("click", () => selectMode("grid")),
						]}
					>
						Tileset grid
					</button>
					<button
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, borderColor: mode === "manual" ? ACCENT : IDLE_BORDER }),
							on<HTMLButtonElement, "click">("click", () => selectMode("manual")),
						]}
					>
						Sprite atlas
					</button>
				</div>

				{mode === "grid" ? (
					<div
						mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}
					>
						<label mix={LABEL}>
							Tile W
							<input
								type="number"
								min="1"
								value={String(tileWidth)}
								mix={[
									css({ ...FIELD, width: "4.5rem" }),
									on<HTMLInputElement, "change">("change", (event) =>
										setNumber(
											(value) => {
												tileWidth = Math.max(1, value);
											},
											(event.target as HTMLInputElement).value,
										),
									),
								]}
							/>
						</label>
						<label mix={LABEL}>
							Tile H
							<input
								type="number"
								min="1"
								value={String(tileHeight)}
								mix={[
									css({ ...FIELD, width: "4.5rem" }),
									on<HTMLInputElement, "change">("change", (event) =>
										setNumber(
											(value) => {
												tileHeight = Math.max(1, value);
											},
											(event.target as HTMLInputElement).value,
										),
									),
								]}
							/>
						</label>
						<label mix={LABEL}>
							Margin
							<input
								type="number"
								min="0"
								value={String(margin)}
								mix={[
									css({ ...FIELD, width: "4.5rem" }),
									on<HTMLInputElement, "change">("change", (event) =>
										setNumber(
											(value) => {
												margin = value;
											},
											(event.target as HTMLInputElement).value,
										),
									),
								]}
							/>
						</label>
						<label mix={LABEL}>
							Spacing
							<input
								type="number"
								min="0"
								value={String(spacing)}
								mix={[
									css({ ...FIELD, width: "4.5rem" }),
									on<HTMLInputElement, "change">("change", (event) =>
										setNumber(
											(value) => {
												spacing = value;
											},
											(event.target as HTMLInputElement).value,
										),
									),
								]}
							/>
						</label>
						<label mix={LABEL}>
							Names
							<select
								value={naming}
								mix={[
									css(FIELD),
									on<HTMLSelectElement, "change">("change", (event) => {
										naming = (event.target as HTMLSelectElement).value as GridNaming;
										renderPreview();
										void handle.update();
									}),
								]}
							>
								<option value="index" selected={naming === "index"}>
									tile.N (row-major)
								</option>
								<option value="grid" selected={naming === "grid"}>
									r&#123;row&#125;c&#123;col&#125;
								</option>
							</select>
						</label>
					</div>
				) : (
					<div mix={css({ display: "grid", gap: "0.75rem", justifyItems: "start" })}>
						<div
							mix={css({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.75rem",
								alignItems: "flex-end",
							})}
						>
							<label mix={LABEL}>
								Region name
								<input
									type="text"
									value={draftName}
									placeholder="hero.down"
									mix={[
										css({ ...FIELD, width: "10rem" }),
										on<HTMLInputElement, "input">("input", (event) => {
											draftName = (event.target as HTMLInputElement).value;
										}),
									]}
								/>
							</label>
							<label mix={LABEL}>
								X
								<input
									type="number"
									min="0"
									value={String(draftX)}
									mix={[
										css({ ...FIELD, width: "4.5rem" }),
										on<HTMLInputElement, "change">("change", (event) =>
											setNumber(
												(value) => {
													draftX = value;
												},
												(event.target as HTMLInputElement).value,
											),
										),
									]}
								/>
							</label>
							<label mix={LABEL}>
								Y
								<input
									type="number"
									min="0"
									value={String(draftY)}
									mix={[
										css({ ...FIELD, width: "4.5rem" }),
										on<HTMLInputElement, "change">("change", (event) =>
											setNumber(
												(value) => {
													draftY = value;
												},
												(event.target as HTMLInputElement).value,
											),
										),
									]}
								/>
							</label>
							<label mix={LABEL}>
								W
								<input
									type="number"
									min="1"
									value={String(draftW)}
									mix={[
										css({ ...FIELD, width: "4.5rem" }),
										on<HTMLInputElement, "change">("change", (event) =>
											setNumber(
												(value) => {
													draftW = Math.max(1, value);
												},
												(event.target as HTMLInputElement).value,
											),
										),
									]}
								/>
							</label>
							<label mix={LABEL}>
								H
								<input
									type="number"
									min="1"
									value={String(draftH)}
									mix={[
										css({ ...FIELD, width: "4.5rem" }),
										on<HTMLInputElement, "change">("change", (event) =>
											setNumber(
												(value) => {
													draftH = Math.max(1, value);
												},
												(event.target as HTMLInputElement).value,
											),
										),
									]}
								/>
							</label>
							<button
								type="button"
								mix={[
									css(CONTROL_BUTTON),
									on<HTMLButtonElement, "click">("click", () => addDraftRegion()),
								]}
							>
								Add region
							</button>
						</div>

						{regions.length > 0 ? (
							<ul
								mix={css({
									listStyle: "none",
									margin: 0,
									padding: 0,
									display: "grid",
									gap: "0.35rem",
									width: "100%",
								})}
							>
								{regions.map((region) => (
									<li
										key={region.name}
										mix={css({ display: "flex", gap: "0.5rem", alignItems: "center" })}
									>
										<input
											type="text"
											value={region.name}
											mix={[
												css({ ...FIELD, width: "10rem" }),
												on<HTMLInputElement, "change">("change", (event) =>
													renameNamed(region.name, (event.target as HTMLInputElement).value),
												),
											]}
										/>
										<span mix={css({ color: "#9ca3af", fontSize: "0.8rem" })}>
											{region.rect.x}, {region.rect.y} · {region.rect.w}×{region.rect.h}
										</span>
										<button
											type="button"
											mix={[
												css({ ...CONTROL_BUTTON, padding: "0.25rem 0.5rem" }),
												on<HTMLButtonElement, "click">("click", () => removeNamed(region.name)),
											]}
										>
											Remove
										</button>
									</li>
								))}
							</ul>
						) : null}
					</div>
				)}

				<p mix={css({ margin: 0, color: "#a1a1aa", fontSize: "0.8rem" })}>
					{regionCount} region{regionCount === 1 ? "" : "s"} in the current slice.
				</p>

				<canvas
					mix={[
						css({
							imageRendering: "pixelated",
							border: "1px solid #3f3f46",
							borderRadius: "0.375rem",
							maxWidth: "100%",
							background: "#111113",
						}),
						ref<HTMLCanvasElement>((element, signal) => {
							canvas = element;
							renderPreview();
							signal.addEventListener("abort", () => {
								canvas = null;
							});
						}),
					]}
				/>

				<button
					type="button"
					mix={[
						css({
							padding: "0.55rem 1rem",
							fontFamily: "inherit",
							color: "#052e16",
							background: "#4ade80",
							border: "none",
							borderRadius: "0.375rem",
							cursor: "pointer",
						}),
						on<HTMLButtonElement, "click">("click", () => void runImport()),
					]}
				>
					Import
				</button>

				{status ? (
					<p
						mix={css({
							margin: 0,
							fontSize: "0.85rem",
							color: statusIsError ? "#f87171" : "#4ade80",
						})}
					>
						{status}
					</p>
				) : null}
			</section>
		);
	};
}
