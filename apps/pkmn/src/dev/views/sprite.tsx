/**
 * Sprite tool view. Builds a {@link SpriteEditor} in setup and drives every
 * control — color, tool, size, undo/redo, clear, import, export — through the
 * canvas `ref`. Exports write a flat image or assign the sprite as a named
 * atlas region, reporting success or failure inline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, on, ref } from "remix/ui";

/** The raw parameter type of the `css()` mixin, narrowed by {@link Styles}. */
type CssMixinStyles = Parameters<typeof css>[0];

/**
 * The style-object shape the `css()` mixin accepts, used for shared base
 * styles. Its parameter type carries `CSSStyleDeclaration`'s `Symbol.iterator`
 * member; dropping the symbol keys leaves a plain bag spreadable into overrides.
 */
type Styles = { [K in keyof CssMixinStyles as K extends symbol ? never : K]: CssMixinStyles[K] };

import type { Rgb } from "../editors/pixel-grid";
import type { SpriteTool } from "../editors/sprite-editor";

import { MAX_DIMENSION } from "../editors/pixel-grid";
import { SIZE_PRESETS, SpriteEditor } from "../editors/sprite-editor";

/** Value the size selector uses for the arbitrary custom-dimensions option. */
const CUSTOM_SIZE_ID = "custom";

/**
 * Converts a `#rrggbb` hex color (as produced by `<input type="color">`) into the
 * {@link Rgb} channel triple the editor paints with. Falls back to black for a
 * malformed value so a bad input never throws mid-stroke.
 *
 * @param hex A `#rrggbb` color string.
 * @returns The parsed RGB channels.
 */
function hexToRgb(hex: string): Rgb {
	let match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (match === null) return { r: 0, g: 0, b: 0 };
	return {
		r: Number.parseInt(match[1]!, 16),
		g: Number.parseInt(match[2]!, 16),
		b: Number.parseInt(match[3]!, 16),
	};
}

/**
 * Converts an {@link Rgb} triple back into a `#rrggbb` hex string, so the editor
 * can push a picked/eyedropped color into the `<input type="color">`.
 *
 * @param color The RGB channels to format.
 * @returns The `#rrggbb` representation.
 */
function rgbToHex(color: Rgb): string {
	let hex = (value: number) =>
		Math.max(0, Math.min(255, Math.round(value)))
			.toString(16)
			.padStart(2, "0");
	return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

/**
 * Encodes raw bytes as a standard base64 string using `btoa`, chunking to avoid
 * blowing the argument limit of `String.fromCharCode` on larger sprites.
 *
 * @param bytes The bytes to encode.
 * @returns The base64 representation.
 */
function bytesToBase64(bytes: Uint8Array): string {
	let CHUNK = 0x8000;
	let binary = "";
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

/** Shared base style for the small control buttons (tool/clear/undo/redo). */
const CONTROL_BUTTON: Styles = {
	padding: "0.4rem 0.75rem",
	fontFamily: "inherit",
	color: "#e5e7eb",
	background: "#18181b",
	border: "1px solid #3f3f46",
	borderRadius: "0.375rem",
	cursor: "pointer",
};

/** Shared base style for text/number/color inputs and the size selector. */
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

/** The selectable tools, in toolbar order, with their button labels. */
const TOOLS: Array<{ id: SpriteTool; label: string }> = [
	{ id: "pen", label: "Pen" },
	{ id: "eraser", label: "Eraser" },
	{ id: "fill", label: "Fill" },
	{ id: "eyedropper", label: "Eyedropper" },
];

/**
 * Working sprite-drawing tool. Builds a {@link SpriteEditor} in setup, renders
 * the palette / tool / size / name controls around a canvas bound to the editor
 * via `ref`, and exports the sprite as a flat image or atlas region on demand.
 *
 * @param handle Component handle used to schedule re-renders on control changes.
 * @returns The render function for the sprite tool.
 */
export function SpriteDrawingTool(handle: Handle<Record<string, never>>) {
	let editor = new SpriteEditor();

	let colorHex = "#000000";
	let tool: SpriteTool = "pen";
	let sizeId: string = "16x16";
	let customWidth = editor.width;
	let customHeight = editor.height;
	let name = "";
	let status = "";
	let statusIsError = false;

	/**
	 * A manual edit to the rect pins it, so a later resize preserves the
	 * author's numbers instead of resetting to the whole sprite.
	 */
	let atlasId = "";
	let region = "";
	let rectX = 0;
	let rectY = 0;
	let rectW = editor.width;
	let rectH = editor.height;
	let rectPinned = false;

	/** Re-renders on every editor change so the undo/redo buttons reflect its history. */
	editor.onStateChange(() => {
		if (!rectPinned) {
			rectW = editor.width;
			rectH = editor.height;
		}
		void handle.update();
	});
	editor.onColorPicked((color) => {
		colorHex = rgbToHex(color);
		void handle.update();
	});

	/** Applies the current custom dimensions to the editor (clamped to the cap). */
	function applyCustomSize() {
		let width = Math.min(Math.max(1, Math.trunc(customWidth)), MAX_DIMENSION);
		let height = Math.min(Math.max(1, Math.trunc(customHeight)), MAX_DIMENSION);
		customWidth = width;
		customHeight = height;
		editor.resize(width, height);
	}

	/** Handles a size-selector change: apply a preset or switch to custom sizing. */
	function selectSize(nextId: string) {
		sizeId = nextId;
		if (nextId === CUSTOM_SIZE_ID) {
			applyCustomSize();
		} else {
			let preset = SIZE_PRESETS.find((entry) => entry.id === nextId);
			if (preset) {
				customWidth = preset.width;
				customHeight = preset.height;
				editor.resize(preset.width, preset.height);
			}
		}
		void handle.update();
	}

	/** Selects a drawing tool and re-renders the toolbar. */
	function selectTool(next: SpriteTool) {
		tool = next;
		editor.setTool(next);
		void handle.update();
	}

	/** Sets the current color from a hex string and re-renders. */
	function applyColor(hex: string) {
		colorHex = hex;
		editor.setColor(hexToRgb(hex));
		void handle.update();
	}

	/** Reports an outcome inline and re-renders. */
	function report(message: string, isError: boolean) {
		status = message;
		statusIsError = isError;
		void handle.update();
	}

	/** Imports a selected image file back into the grid, resizing to match. */
	async function importFile(file: File) {
		report("Importing…", false);
		try {
			await editor.importImage(file);
			customWidth = editor.width;
			customHeight = editor.height;
			sizeId = CUSTOM_SIZE_ID;
			if (!rectPinned) {
				rectW = editor.width;
				rectH = editor.height;
			}
			report(`Imported ${file.name} (${editor.width}×${editor.height}).`, false);
		} catch (error) {
			report(`Import failed: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	}

	/** Renders the sprite to PNG, uploads it, and registers it as a flat image. */
	async function exportSprite() {
		if (name.trim().length === 0) {
			report("Enter a name before exporting.", true);
			return;
		}

		report("Exporting…", false);
		try {
			let png = await editor.toPng();
			let response = await fetch("/dev/export/sprite", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: name.trim(), pngBase64: bytesToBase64(png) }),
			});
			let data = (await response.json()) as { path?: string; url?: string; error?: string };
			if (response.ok)
				report(`Wrote ${data.path} and registered "${name.trim()}" → ${data.url}`, false);
			else report(`Export failed: ${data.error ?? response.statusText}`, true);
		} catch (error) {
			report(`Export failed: ${error instanceof Error ? error.message : String(error)}`, true);
		}
	}

	/** Renders the sprite to PNG and assigns it as a named atlas region. */
	async function exportAtlas() {
		if (name.trim().length === 0) {
			report("Enter a name before exporting.", true);
			return;
		}
		if (atlasId.trim().length === 0 || region.trim().length === 0) {
			report("Enter an atlas id and a region name before assigning.", true);
			return;
		}

		report("Assigning to atlas…", false);
		try {
			let png = await editor.toPng();
			let response = await fetch("/dev/export/atlas", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					pngBase64: bytesToBase64(png),
					atlasId: atlasId.trim(),
					region: region.trim(),
					x: Math.trunc(rectX),
					y: Math.trunc(rectY),
					w: Math.trunc(rectW),
					h: Math.trunc(rectH),
				}),
			});
			let data = (await response.json()) as {
				path?: string;
				url?: string;
				atlasId?: string;
				region?: string;
				error?: string;
			};
			if (response.ok)
				report(
					`Wrote ${data.path} and assigned it as region "${data.region}" in atlas "${data.atlasId}".`,
					false,
				);
			else report(`Atlas export failed: ${data.error ?? response.statusText}`, true);
		} catch (error) {
			report(
				`Atlas export failed: ${error instanceof Error ? error.message : String(error)}`,
				true,
			);
		}
	}

	return () => (
		<section mix={css({ display: "grid", gap: "1rem", justifyItems: "start" })}>
			<header mix={css({ display: "grid", gap: "0.25rem" })}>
				<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Sprite</h2>
				<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
					Draw a pixel sprite, then export it to <code>src/assets</code> and register it in the
					asset manifest — as a flat image or a named atlas region.
				</p>
			</header>

			<div mix={css({ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" })}>
				<label mix={LABEL}>
					Color
					<input
						type="color"
						value={colorHex}
						mix={[
							css({
								width: "3rem",
								height: "2.25rem",
								padding: 0,
								background: "transparent",
								border: "none",
								cursor: "pointer",
							}),
							on<HTMLInputElement, "input">("input", (event) => {
								applyColor((event.target as HTMLInputElement).value);
							}),
						]}
					/>
				</label>

				<label mix={LABEL}>
					Size
					<select
						value={sizeId}
						mix={[
							css(FIELD),
							on<HTMLSelectElement, "change">("change", (event) => {
								selectSize((event.target as HTMLSelectElement).value);
							}),
						]}
					>
						{SIZE_PRESETS.map((preset) => (
							<option key={preset.id} value={preset.id}>
								{preset.label}
							</option>
						))}
						<option value={CUSTOM_SIZE_ID}>Custom…</option>
					</select>
				</label>

				{sizeId === CUSTOM_SIZE_ID ? (
					<label mix={LABEL}>
						Custom (W × H, max {MAX_DIMENSION})
						<span mix={css({ display: "flex", gap: "0.35rem", alignItems: "center" })}>
							<input
								type="number"
								min="1"
								max={String(MAX_DIMENSION)}
								value={String(customWidth)}
								mix={[
									css({ ...FIELD, width: "4.5rem" }),
									on<HTMLInputElement, "change">("change", (event) => {
										customWidth = Number((event.target as HTMLInputElement).value);
										applyCustomSize();
										void handle.update();
									}),
								]}
							/>
							<span mix={css({ color: "#9ca3af" })}>×</span>
							<input
								type="number"
								min="1"
								max={String(MAX_DIMENSION)}
								value={String(customHeight)}
								mix={[
									css({ ...FIELD, width: "4.5rem" }),
									on<HTMLInputElement, "change">("change", (event) => {
										customHeight = Number((event.target as HTMLInputElement).value);
										applyCustomSize();
										void handle.update();
									}),
								]}
							/>
						</span>
					</label>
				) : null}
			</div>

			<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.5rem" })}>
				{TOOLS.map((entry) => (
					<button
						key={entry.id}
						type="button"
						mix={[
							css({ ...CONTROL_BUTTON, borderColor: tool === entry.id ? "#6366f1" : "#3f3f46" }),
							on<HTMLButtonElement, "click">("click", () => selectTool(entry.id)),
						]}
					>
						{entry.label}
					</button>
				))}
				<button
					type="button"
					disabled={!editor.canUndo}
					mix={[
						css({ ...CONTROL_BUTTON, opacity: editor.canUndo ? 1 : 0.5 }),
						on<HTMLButtonElement, "click">("click", () => {
							editor.undo();
						}),
					]}
				>
					Undo
				</button>
				<button
					type="button"
					disabled={!editor.canRedo}
					mix={[
						css({ ...CONTROL_BUTTON, opacity: editor.canRedo ? 1 : 0.5 }),
						on<HTMLButtonElement, "click">("click", () => {
							editor.redo();
						}),
					]}
				>
					Redo
				</button>
				<button
					type="button"
					mix={[css(CONTROL_BUTTON), on<HTMLButtonElement, "click">("click", () => editor.clear())]}
				>
					Clear
				</button>
			</div>

			{editor.recentColors.length > 0 ? (
				<div mix={LABEL}>
					Recent colors
					<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.35rem" })}>
						{editor.recentColors.map((color) => {
							let hex = rgbToHex(color);
							return (
								<button
									key={hex}
									type="button"
									title={hex}
									mix={[
										css({
											width: "1.75rem",
											height: "1.75rem",
											padding: 0,
											background: hex,
											border: "1px solid #3f3f46",
											borderRadius: "0.25rem",
											cursor: "pointer",
										}),
										on<HTMLButtonElement, "click">("click", () => applyColor(hex)),
									]}
								/>
							);
						})}
					</div>
				</div>
			) : null}

			<canvas
				mix={[
					css({
						imageRendering: "pixelated",
						border: "1px solid #3f3f46",
						borderRadius: "0.375rem",
						width: "512px",
						height: "512px",
						maxWidth: "100%",
						touchAction: "none",
					}),
					ref<HTMLCanvasElement>((element, signal) => {
						editor.attach(element);
						editor.setColor(hexToRgb(colorHex));
						editor.setTool(tool);
						window.addEventListener(
							"keydown",
							(event) => {
								if (!(event.ctrlKey || event.metaKey)) return;
								if (event.key.toLowerCase() !== "z") return;
								event.preventDefault();
								if (event.shiftKey) editor.redo();
								else editor.undo();
							},
							{ signal },
						);
						signal.addEventListener("abort", () => editor.detach());
					}),
				]}
			/>

			<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}>
				<label mix={LABEL}>
					Import PNG
					<input
						type="file"
						accept="image/png,image/*"
						mix={[
							css({ ...FIELD, width: "12rem" }),
							on<HTMLInputElement, "change">("change", (event) => {
								let input = event.target as HTMLInputElement;
								let file = input.files?.[0];
								if (file) void importFile(file);
								/** Clears the value so re-selecting the same file still fires `change`. */
								input.value = "";
							}),
						]}
					/>
				</label>
			</div>

			<div mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}>
				<label mix={LABEL}>
					Name
					<input
						type="text"
						value={name}
						placeholder="hero-front"
						mix={[
							css({ ...FIELD, width: "12rem" }),
							on<HTMLInputElement, "input">("input", (event) => {
								name = (event.target as HTMLInputElement).value;
							}),
						]}
					/>
				</label>
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
						on<HTMLButtonElement, "click">("click", () => void exportSprite()),
					]}
				>
					Export PNG
				</button>
			</div>

			<fieldset
				mix={css({
					display: "grid",
					gap: "0.75rem",
					margin: 0,
					padding: "0.85rem 1rem 1rem",
					border: "1px solid #3f3f46",
					borderRadius: "0.5rem",
				})}
			>
				<legend mix={css({ padding: "0 0.35rem", color: "#9ca3af", fontSize: "0.85rem" })}>
					Assign to atlas region
				</legend>
				<div
					mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}
				>
					<label mix={LABEL}>
						Atlas id
						<input
							type="text"
							value={atlasId}
							placeholder="characters"
							mix={[
								css({ ...FIELD, width: "10rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									atlasId = (event.target as HTMLInputElement).value;
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Region name
						<input
							type="text"
							value={region}
							placeholder="hero.down"
							mix={[
								css({ ...FIELD, width: "10rem" }),
								on<HTMLInputElement, "input">("input", (event) => {
									region = (event.target as HTMLInputElement).value;
								}),
							]}
						/>
					</label>
				</div>
				<div
					mix={css({ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" })}
				>
					<label mix={LABEL}>
						X
						<input
							type="number"
							min="0"
							value={String(rectX)}
							mix={[
								css({ ...FIELD, width: "4.5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									rectX = Number((event.target as HTMLInputElement).value);
									rectPinned = true;
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						Y
						<input
							type="number"
							min="0"
							value={String(rectY)}
							mix={[
								css({ ...FIELD, width: "4.5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									rectY = Number((event.target as HTMLInputElement).value);
									rectPinned = true;
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						W
						<input
							type="number"
							min="1"
							value={String(rectW)}
							mix={[
								css({ ...FIELD, width: "4.5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									rectW = Number((event.target as HTMLInputElement).value);
									rectPinned = true;
								}),
							]}
						/>
					</label>
					<label mix={LABEL}>
						H
						<input
							type="number"
							min="1"
							value={String(rectH)}
							mix={[
								css({ ...FIELD, width: "4.5rem" }),
								on<HTMLInputElement, "change">("change", (event) => {
									rectH = Number((event.target as HTMLInputElement).value);
									rectPinned = true;
								}),
							]}
						/>
					</label>
					<button
						type="button"
						mix={[
							css(CONTROL_BUTTON),
							on<HTMLButtonElement, "click">("click", () => {
								rectX = 0;
								rectY = 0;
								rectW = editor.width;
								rectH = editor.height;
								rectPinned = false;
								void handle.update();
							}),
						]}
					>
						Whole sprite
					</button>
				</div>
				<button
					type="button"
					mix={[
						css({
							justifySelf: "start",
							padding: "0.55rem 1rem",
							fontFamily: "inherit",
							color: "#0b1120",
							background: "#818cf8",
							border: "none",
							borderRadius: "0.375rem",
							cursor: "pointer",
						}),
						on<HTMLButtonElement, "click">("click", () => void exportAtlas()),
					]}
				>
					Export to atlas
				</button>
			</fieldset>

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
}
