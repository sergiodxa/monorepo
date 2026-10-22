/**
 * Keyboard input for prompts: `node:readline`'s keypress events on a stdin in raw mode, which
 * run the same on Node and Bun, behind a queue a prompt reads one key at a time. Closing the
 * reader leaves raw mode and pauses stdin, so the process can exit once a prompt is answered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { emitKeypressEvents } from "node:readline";

import { iife } from "@sdxc/iife";

import { graphemes } from "./style.js";

/** One key press, shaped as `node:readline` reports it. */
export interface Key {
	/** `"return"`, `"up"`, `"a"`, `"space"`…; empty for a character readline does not name. */
	name: string;
	/** The characters the key produced. */
	sequence: string;
	ctrl: boolean;
	meta: boolean;
	shift: boolean;
}

/** Reads keys one at a time. */
export interface Keyboard {
	/** The next key, or `null` once no more will arrive (`signal` aborted, input ended). */
	read(signal: AbortSignal): Promise<Key | null>;
	/** Stops reading and gives the input back. */
	close(): void;
}

/** A readable stream a CLI reads keys from; `process.stdin` is one. */
export interface Input extends NodeJS.EventEmitter {
	isTTY?: boolean;
	setRawMode?(mode: boolean): unknown;
	resume(): unknown;
	pause(): unknown;
}

/**
 * Starts reading keys from `input` in raw mode.
 *
 * @param onRaw - Told when raw mode turns on and off, so an exit handler can leave it
 */
export function openKeyboard(input: Input, onRaw: (raw: boolean) => void): Keyboard {
	emitKeypressEvents(input as NodeJS.ReadableStream);
	input.setRawMode?.(true);
	onRaw(true);
	input.resume();
	let queue: Key[] = [];
	let waiting: ((key: Key | null) => void) | undefined;
	let ended = false;

	/** Queues one key, or hands it to the read waiting for it. */
	function onKeypress(sequence: string | undefined, key: Partial<Key> | undefined): void {
		let pressed: Key = {
			name: key?.name ?? "",
			sequence: key?.sequence ?? sequence ?? "",
			ctrl: key?.ctrl === true,
			meta: key?.meta === true,
			shift: key?.shift === true,
		};
		if (waiting === undefined) queue.push(pressed);
		else {
			let resolve = waiting;
			waiting = undefined;
			resolve(pressed);
		}
	}

	/** Ends every pending read once the input closes. */
	function onEnd(): void {
		ended = true;
		waiting?.(null);
		waiting = undefined;
	}

	input.on("keypress", onKeypress);
	input.on("end", onEnd);
	return {
		read(signal) {
			let next = queue.shift();
			if (next !== undefined) return Promise.resolve(next);
			if (ended || signal.aborted) return Promise.resolve(null);
			return new Promise((resolve) => {
				let abort = () => {
					waiting = undefined;
					resolve(null);
				};
				signal.addEventListener("abort", abort, { once: true });
				waiting = (key) => {
					signal.removeEventListener("abort", abort);
					resolve(key);
				};
			});
		},
		close() {
			input.off("keypress", onKeypress);
			input.off("end", onEnd);
			input.setRawMode?.(false);
			onRaw(false);
			input.pause();
		},
	};
}

/** Keys a script names by something other than the character they type. */
const NAMED_KEYS: Readonly<Record<string, string>> = {
	enter: "return",
	return: "return",
	space: "space",
	up: "up",
	down: "down",
	left: "left",
	right: "right",
	home: "home",
	end: "end",
	tab: "tab",
	backspace: "backspace",
	delete: "delete",
	escape: "escape",
	pageup: "pageup",
	pagedown: "pagedown",
};

/**
 * The key a script names: `"enter"`, `"down"`, `"ctrl+c"`, or a single character. Longer text is
 * not a key; {@link keysFromScript} types it one character at a time.
 */
export function keyFromName(name: string): Key {
	let ctrl = name.startsWith("ctrl+");
	let bare = ctrl ? name.slice(5) : name;
	let named = NAMED_KEYS[bare];
	if (named !== undefined) {
		let sequence = iife(() => {
			if (named === "space") return " ";
			if (named === "return") return "\r";
			return "";
		});
		return { name: named, sequence, ctrl, meta: false, shift: false };
	}
	let shift = bare !== bare.toLowerCase();
	return {
		name: /^[a-z0-9]$/i.test(bare) ? bare.toLowerCase() : "",
		sequence: ctrl ? String.fromCharCode(bare.charCodeAt(0) & 31) : bare,
		ctrl,
		meta: false,
		shift,
	};
}

/** A test's key script as key presses: named keys as one press, other text one per character. */
export function keysFromScript(script: readonly string[]): Key[] {
	let keys: Key[] = [];
	for (let entry of script) {
		if (entry.length === 1 || NAMED_KEYS[entry] !== undefined || entry.startsWith("ctrl+")) {
			keys.push(keyFromName(entry));
		} else {
			for (let character of entry) keys.push(keyFromName(character));
		}
	}
	return keys;
}

/** Whether `key` cancels a prompt: Ctrl+C or Escape. */
export function isCancel(key: Key): boolean {
	return (key.ctrl && key.name === "c") || key.name === "escape";
}

/** The printable character `key` types, or `undefined` for a control key. */
export function typed(key: Key): string | undefined {
	if (key.ctrl || key.meta) return undefined;
	if (key.name === "space") return " ";
	let sequence = key.sequence;
	if (sequence.length === 0 || sequence.startsWith("\u001B")) return undefined;
	if (graphemes(sequence).length !== 1) return undefined;
	return (sequence.codePointAt(0) as number) >= 32 && sequence !== "\u007F" ? sequence : undefined;
}
