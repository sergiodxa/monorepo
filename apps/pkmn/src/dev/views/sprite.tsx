/**
 * Sprite tool view — a working pixel editor built on the canonical editor
 * pattern. The component constructs a {@link SpriteEditor} once in setup and
 * hands it the canvas via the `ref` mixin when the canvas mounts; every control
 * (color, tool, size, clear, export) drives that single editor instance. There
 * are no framework hooks: local state lives in setup-scope variables and the
 * component re-renders through `handle.update()` when a control changes it.
 *
 * Export reads the editor's native-resolution PNG bytes, base64-encodes them, and
 * POSTs to the sprite export action, which writes `src/assets/<name>.png` and
 * registers the image in the asset manifest. Success and failure are surfaced
 * inline so the author sees where the file landed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, on, ref } from "remix/ui";

/** The style-object shape the `css()` mixin accepts, used for shared base styles. */
type Styles = Parameters<typeof css>[0];

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

/** Shared base style for the small control buttons (tool/clear). */
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

/**
 * Working sprite-drawing tool. Builds a {@link SpriteEditor} in setup, renders the
 * palette / tool / size / name controls around a canvas bound to the editor via
 * `ref`, and exports the drawn sprite to disk on demand.
 *
 * @param handle Component handle used to schedule re-renders on control changes.
 * @returns The render function for the sprite tool.
 */
export function SpriteDrawingTool(handle: Handle<Record<string, never>>) {
	let editor = new SpriteEditor();

	// Local UI state, mirrored back into the view on `handle.update()`.
	let colorHex = "#000000";
	let tool: SpriteTool = "pen";
	let sizeId: string = "16x16";
	let customWidth = editor.width;
	let customHeight = editor.height;
	let name = "";
	let status = "";
	let statusIsError = false;

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

	/** Reports an export outcome inline and re-renders. */
	function report(message: string, isError: boolean) {
		status = message;
		statusIsError = isError;
		void handle.update();
	}

	/** Renders the sprite to PNG, uploads it, and registers it in the manifest. */
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

	return () => (
		<section mix={css({ display: "grid", gap: "1rem", justifyItems: "start" })}>
			<header mix={css({ display: "grid", gap: "0.25rem" })}>
				<h2 mix={css({ margin: 0, fontSize: "1.25rem" })}>Sprite</h2>
				<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
					Draw a pixel sprite, then export it to <code>src/assets</code> and register it in the
					asset manifest.
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
								colorHex = (event.target as HTMLInputElement).value;
								editor.setColor(hexToRgb(colorHex));
								void handle.update();
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
				<button
					type="button"
					mix={[
						css({ ...CONTROL_BUTTON, borderColor: tool === "pen" ? "#6366f1" : "#3f3f46" }),
						on<HTMLButtonElement, "click">("click", () => {
							tool = "pen";
							editor.setTool("pen");
							void handle.update();
						}),
					]}
				>
					Pen
				</button>
				<button
					type="button"
					mix={[
						css({ ...CONTROL_BUTTON, borderColor: tool === "eraser" ? "#6366f1" : "#3f3f46" }),
						on<HTMLButtonElement, "click">("click", () => {
							tool = "eraser";
							editor.setTool("eraser");
							void handle.update();
						}),
					]}
				>
					Eraser
				</button>
				<button
					type="button"
					mix={[css(CONTROL_BUTTON), on<HTMLButtonElement, "click">("click", () => editor.clear())]}
				>
					Clear
				</button>
			</div>

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
						signal.addEventListener("abort", () => editor.detach());
					}),
				]}
			/>

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
