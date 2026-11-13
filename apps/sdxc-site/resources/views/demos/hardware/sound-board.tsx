/**
 * The playable Strata Two: the board drawn large, every key pressable with a pointer, a
 * finger or the reader's own keyboard, each press sounded through Web Audio for the switch
 * the reader picks. Without script the board still presses under a held pointer, silently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { clientEntry, on } from "remix/component";

import type { SwitchKind } from "~/resources/views/demos/hardware/key-sound";

import { playPress, playRelease } from "~/resources/views/demos/hardware/key-sound";
import { Keyboard, KEYS } from "~/resources/views/demos/hardware/keyboard";

/**
 * The board key a physical key presses: its `data-key` and, where the board has two of it
 * (shift, ctrl, cmd), which one, left first.
 */
const CODES: Record<string, [id: string, nth?: number]> = {
	Escape: ["esc"],
	Backquote: ["`"],
	Minus: ["-"],
	Equal: ["="],
	Backspace: ["⌫"],
	Tab: ["tab"],
	BracketLeft: ["["],
	BracketRight: ["]"],
	Backslash: ["\\"],
	CapsLock: ["caps"],
	Semicolon: [";"],
	Quote: ["'"],
	Enter: ["return"],
	ShiftLeft: ["shift", 0],
	ShiftRight: ["shift", 1],
	Comma: [","],
	Period: ["."],
	Slash: ["/"],
	ControlLeft: ["ctrl", 0],
	ControlRight: ["ctrl", 1],
	AltLeft: ["opt"],
	AltRight: ["cmd", 1],
	MetaLeft: ["cmd", 0],
	MetaRight: ["cmd", 1],
	Space: ["space"],
	ArrowUp: ["↑"],
	ArrowDown: ["↓"],
	ArrowLeft: ["←"],
	ArrowRight: ["→"],
	Delete: ["del"],
	Home: ["home"],
	End: ["end"],
	PageUp: ["pg up"],
	PageDown: ["pg dn"],
	PrintScreen: ["prt"],
};

/** Each key's width in units by its `data-key`, so a press sounds as big as the key. */
const WIDTHS = new Map(KEYS.map((key) => [key.id, key.width]));

/** The board's `data-key` for a physical key, from its `code`. */
function boardKey(code: string): [id: string, nth: number] | null {
	let mapped = CODES[code];
	if (mapped) return [mapped[0], mapped[1] ?? 0];
	let letter = /^Key([A-Z])$/.exec(code)?.[1] ?? /^Digit(\d)$/.exec(code)?.[1];
	if (letter) return [letter.toLowerCase(), 0];
	if (/^F([1-9]|1[0-2])$/.test(code)) return [code.toLowerCase(), 0];
	return null;
}

/** The switches the reader can fit, in the order the toggle lists them. */
const SWITCHES: Array<{ kind: SwitchKind; name: string; detail: string }> = [
	{ kind: "silk", name: "Silk", detail: "Linear, 45 g" },
	{ kind: "notch", name: "Notch", detail: "Tactile, 55 g" },
];

/** Props of {@link SoundBoard}, serialised into the page for hydration. */
export type SoundBoardProps = {
	/** The switch the board starts with. */
	start: SwitchKind;
};

/**
 * The island. A press marks the key with `data-down`, which lowers its cap; the sound plays
 * on the same event, so what the reader sees and hears land together. Keyboard input is
 * read only while the board has focus, so typing anywhere else on the page stays silent.
 */
export const SoundBoard = clientEntry(
	import.meta.url,
	function SoundBoard(handle: Handle<SoundBoardProps>) {
		let kind: SwitchKind = handle.props.start;

		/** Presses one key group: lowers it and sounds it, once per press. */
		function press(key: Element | null | undefined) {
			if (!key || key.hasAttribute("data-down")) return;
			key.setAttribute("data-down", "");
			playPress(kind, WIDTHS.get(key.getAttribute("data-key") ?? "") ?? 1);
		}

		/** Lets one key back up, sounding the return stroke. */
		function release(key: Element | null | undefined) {
			if (!key?.hasAttribute("data-down")) return;
			key.removeAttribute("data-down");
			playRelease(kind);
		}

		/** The key group a physical key maps to, inside this board. */
		function physical(board: Element, code: string) {
			let mapped = boardKey(code);
			if (!mapped) return null;
			let [id, nth] = mapped;
			return board.querySelectorAll(`[data-key="${CSS.escape(id)}"]`)[nth] ?? null;
		}

		return () => (
			<div mix={[raw({ display: "grid", gap: "1.5rem", justifyItems: "center" })]}>
				<fieldset
					mix={[
						raw({
							display: "inline-flex",
							gap: "0.25rem",
							padding: "0.25rem",
							margin: "0",
							border: "0",
							borderRadius: "9999px",
							backgroundColor: "oklch(1 0 0 / 0.06)",
							boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
						}),
					]}
				>
					<legend
						mix={[
							raw({
								position: "absolute",
								inlineSize: "1px",
								blockSize: "1px",
								overflow: "hidden",
								clipPath: "inset(50%)",
								whiteSpace: "nowrap",
							}),
						]}
					>
						Switch to hear
					</legend>
					{SWITCHES.map((option) => (
						<label
							key={option.kind}
							mix={[
								raw({
									display: "grid",
									gap: "0.0625rem",
									paddingBlock: "0.5rem",
									paddingInline: "1.25rem",
									borderRadius: "9999px",
									cursor: "pointer",
									textAlign: "center",
									color: "var(--ui-neutral-fg-muted)",
									"&:has(:checked)": {
										backgroundColor: "var(--ui-color-neutral-100)",
										color: "var(--ui-color-neutral-950)",
									},
									"&:has(:focus-visible)": {
										outline: "2px solid var(--ui-color-brand-500)",
										outlineOffset: "2px",
									},
								}),
							]}
						>
							<input
								type="radio"
								name="strata-sound-switch"
								value={option.kind}
								checked={kind === option.kind}
								mix={[
									raw({ position: "absolute", opacity: "0", pointerEvents: "none" }),
									on("change", () => {
										kind = option.kind;
										void handle.update();
									}),
								]}
							/>
							<span mix={[raw({ fontWeight: "600", fontSize: "0.9375rem" })]}>{option.name}</span>
							<span mix={[raw({ fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" })]}>
								{option.detail}
							</span>
						</label>
					))}
				</fieldset>
				<div
					data-slot="strata-sound-board-scroller"
					mix={[
						raw({
							inlineSize: "100%",
							overflowX: "auto",
							overscrollBehaviorX: "contain",
							paddingBlock: "0.75rem 3rem",
							paddingInline: "0.75rem",
							scrollbarWidth: "thin",
						}),
					]}
				>
					<button
						type="button"
						aria-label="Playable Strata Two. Press its keys with a pointer, or focus it and type."
						data-slot="strata-sound-board"
						mix={[
							raw({
								display: "block",
								inlineSize: "100%",
								minInlineSize: "44rem",
								padding: "0",
								border: "0",
								background: "none",
								color: "inherit",
								font: "inherit",
								touchAction: "manipulation",
								userSelect: "none",
								WebkitUserSelect: "none",
								WebkitTapHighlightColor: "transparent",
								cursor: "pointer",
								borderRadius: "1.25rem",
								filter: "drop-shadow(0 2.5rem 2rem oklch(0 0 0 / 0.5))",
								"&:focus-visible": {
									outline: "2px solid var(--ui-color-brand-500)",
									outlineOffset: "0.5rem",
								},
							}),
							on("pointerdown", (event) => {
								let key = (event.target as Element).closest("[data-key]");
								if (!key) return;
								event.preventDefault();
								(event.currentTarget as HTMLElement).focus({ preventScroll: true });
								press(key);
							}),
							on("pointerup", (event) => {
								for (let key of (event.currentTarget as Element).querySelectorAll("[data-down]")) {
									release(key);
								}
							}),
							on("pointercancel", (event) => {
								for (let key of (event.currentTarget as Element).querySelectorAll("[data-down]")) {
									key.removeAttribute("data-down");
								}
							}),
							on("pointerleave", (event) => {
								for (let key of (event.currentTarget as Element).querySelectorAll("[data-down]")) {
									release(key);
								}
							}),
							on("keydown", (event) => {
								if (event.metaKey && event.code !== "MetaLeft" && event.code !== "MetaRight")
									return;
								let key = physical(event.currentTarget as Element, event.code);
								if (!key) return;
								if (event.code !== "Tab") event.preventDefault();
								if (!event.repeat) press(key);
							}),
							on("keyup", (event) => {
								release(physical(event.currentTarget as Element, event.code));
							}),
							on("blur", (event) => {
								for (let key of (event.currentTarget as Element).querySelectorAll("[data-down]")) {
									key.removeAttribute("data-down");
								}
							}),
						]}
					>
						<Keyboard id="play" pressable />
					</button>
				</div>
			</div>
		);
	},
);
