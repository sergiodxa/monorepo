/**
 * One keyboard-shortcut system for an app page: single keys, chords and `g`+key sequences
 * registered from script or declared in server HTML with `data-shortcut`, resolved by layer so
 * the topmost open modal answers before a sheet and a sheet before the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/component";

import type { KeyCombo } from "../../utils/key-combo.js";

import {
	isTypingTarget,
	keyComboGlyphs,
	matchesKeyCombo,
	parseKeyCombo,
} from "../../utils/key-combo.js";

/**
 * Attribute a link, button or field declares its shortcut on, as `"g m"`, `"c"` or
 * `"s, /"` (comma-separated alternatives). Pressing it clicks the element, or focuses it
 * when it is a field.
 */
export const SHORTCUT_ATTRIBUTE = "data-shortcut";

/** Attribute naming a declared shortcut in the help sheet; an empty value keeps it unlisted. */
export const SHORTCUT_LABEL_ATTRIBUTE = "data-shortcut-label";

/** Attribute naming the help-sheet group of every shortcut declared on or inside its element. */
export const SHORTCUT_GROUP_ATTRIBUTE = "data-shortcut-group";

/**
 * Attribute marking an element as a shortcut layer, `"sheet"` or `"modal"`, for a panel built
 * from something other than `<dialog>` or `[popover]`. The layer counts as open while it and
 * its ancestors are free of `hidden` and `inert`.
 */
export const SHORTCUT_SCOPE_ATTRIBUTE = "data-shortcut-scope";

/** Milliseconds a sequence waits for its next key before the keys typed so far are dropped. */
export const SHORTCUT_SEQUENCE_TIMEOUT_MS = 1200;

/**
 * Priorities for the Escape ladder: with every handler declining when it has nothing to undo,
 * one press clears the selection, the next clears the filters, and only then does a panel close.
 */
export const ESCAPE_PRIORITY = { selection: 30, filters: 20, close: 10 } as const;

/** Elements that open a layer above the page. */
const LAYER_SELECTOR = `dialog, [popover], [${SHORTCUT_SCOPE_ATTRIBUTE}]`;

/** Keys that only modify another key, which leave a pending sequence waiting. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]);

/** Glyphs for the named keys a hint prints as a symbol. */
const NAMED_GLYPHS: Record<string, string> = {
	arrowup: "↑",
	arrowdown: "↓",
	arrowleft: "←",
	arrowright: "→",
	space: "Space",
	backspace: "⌫",
	tab: "Tab",
};

/** Rank of each layer: a higher rank answers first. */
const LAYER_RANK = { page: 0, sheet: 1, modal: 2 } as const;

/** Every registry made by {@link shortcutRegistry}, one per document. */
const REGISTRIES = new WeakMap<Document, ShortcutRegistry>();

/**
 * Types for {@link ShortcutRegistry}.
 */
export namespace Shortcuts {
	/** The layers a shortcut can belong to, from lowest to highest. */
	export type Layer = "page" | "sheet" | "modal";

	/** A shortcut registered from script. */
	export interface Registration {
		/**
		 * The keys that run it: a combo (`"mod+k"`, `"?"`, `"escape"`), a space-separated
		 * sequence (`"g m"`), or several of either as alternatives.
		 */
		keys: string | readonly string[];
		/**
		 * Runs the shortcut. Returning `false` declines the keystroke, which then reaches the
		 * next candidate, so an Escape handler with nothing to clear lets the next one act.
		 */
		run(event: KeyboardEvent): boolean | void;
		/** What it does, as the help sheet lists it; unlabelled shortcuts stay unlisted. */
		label?: string;
		/** The help-sheet heading it lists under. */
		group?: string;
		/**
		 * An element inside the layer it belongs to: its nearest open `<dialog>`, `[popover]`
		 * or `[data-shortcut-scope]`. Omitted, it belongs to the page.
		 */
		scope?: Element | null;
		/** Breaks a tie within one layer; the higher number answers first. @default 0 */
		priority?: number;
		/** Answers while focus is in a text field, as Escape and `mod+k` do. @default false */
		whileTyping?: boolean;
		/**
		 * Answers while a modal above its layer is open, below that modal's own shortcuts:
		 * the key that toggles a palette closes it again. @default false
		 */
		global?: boolean;
		/** Takes the shortcut out of the registry. */
		signal?: AbortSignal;
	}

	/** One row of the help sheet. */
	export interface Entry {
		/** The alternatives that run it, each a combo or sequence as registered. */
		keys: string[];
		label: string;
		group?: string;
	}

	/** Options for {@link ShortcutRegistry}. */
	export interface Options {
		/** Milliseconds a sequence waits for its next key. @default SHORTCUT_SEQUENCE_TIMEOUT_MS */
		sequenceTimeout?: number;
	}

	/** Events a {@link ShortcutRegistry} dispatches. */
	export interface Events {
		/** A shortcut was registered or removed, so a help sheet lists it anew. */
		change: Event;
	}
}

/** A registration with its alternatives parsed into steps, in registration order. */
interface Compiled {
	registration: Shortcuts.Registration;
	sequences: KeyCombo[][];
	order: number;
}

/** A keystroke a pending sequence matched, kept to compare later alternatives against. */
type Stroke = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">;

/**
 * Splits `keys` into its alternatives: an array as given, a string at its commas. A lone
 * `","` stays the comma key.
 *
 * @param keys The keys as registered.
 * @returns Each alternative, trimmed.
 */
export function shortcutAlternatives(keys: string | readonly string[]): string[] {
	if (typeof keys === "string" && keys.trim() === ",") return [","];
	let list = typeof keys === "string" ? keys.split(",") : keys;
	return list.map((alternative) => alternative.trim()).filter((alternative) => alternative !== "");
}

/**
 * Parses one step of a sequence, reading `space` as the space bar, which `KeyboardEvent.key`
 * reports as `" "`.
 */
function parseStep(step: string): KeyCombo {
	let tokens = step.split("+");
	if (tokens.at(-1)?.toLowerCase() !== "space") return parseKeyCombo(step);
	return { ...parseKeyCombo([...tokens.slice(0, -1), "x"].join("+")), key: " ", character: false };
}

/** Parses an alternative into its steps, splitting a sequence at its spaces. */
function parseSequence(alternative: string): KeyCombo[] {
	return alternative
		.split(/\s+/)
		.filter((step) => step !== "")
		.map(parseStep);
}

/** Whether a keystroke strikes one parsed step, the space bar included. */
function matchesStep(stroke: Stroke, step: KeyCombo): boolean {
	if (step.key !== " ") return matchesKeyCombo(stroke, step);
	return (
		stroke.key === " " &&
		stroke.altKey === step.alt &&
		stroke.shiftKey === step.shift &&
		(step.mod ? stroke.ctrlKey || stroke.metaKey : stroke.ctrlKey === step.ctrl)
	);
}

/**
 * The key caps a hint prints for one alternative, sequence steps in press order, with arrows
 * and the space bar as their symbols. A letter prints as its cap, upper-cased, and a capital
 * letter, which only Shift types, prints with the Shift cap before it.
 *
 * @param alternative A combo or sequence, e.g. `"g m"`, `"mod+k"`, `"arrowdown"`.
 * @param apple Whether the reader's keyboard carries the Apple modifier glyphs.
 * @returns The caps to render.
 * @example shortcutGlyphs("g m", true) // ["G", "M"]
 */
export function shortcutGlyphs(alternative: string, apple: boolean): string[] {
	return alternative
		.split(/\s+/)
		.filter((step) => step !== "")
		.flatMap((step) => {
			let tokens = step.split("+");
			let last = tokens.at(-1) ?? "";
			let named = NAMED_GLYPHS[last.toLowerCase()];
			let glyphs = keyComboGlyphs(step, apple);
			if (named !== undefined) glyphs[glyphs.length - 1] = named;
			else if (tokens.length === 1 && /^[a-z]$/.test(last)) glyphs[0] = last.toUpperCase();
			else if (tokens.length === 1 && /^[A-Z]$/.test(last)) {
				return [...keyComboGlyphs("shift+x", apple).slice(0, 1), last];
			}
			return glyphs;
		});
}

/**
 * Whether the reader's keyboard prints the Apple modifier glyphs, read from the platform the
 * browser reports. On a server it answers `true`, the glyphs most readers see.
 *
 * @returns Whether to print ⌘ for `mod`.
 */
export function isApplePlatform(): boolean {
	if (typeof navigator === "undefined") return true;
	return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** Whether a layer element is showing. */
function isLayerOpen(layer: Element): boolean {
	if (layer instanceof HTMLDialogElement) return layer.open;
	if (layer.hasAttribute("popover")) return layer.matches(":popover-open");
	return layer.closest("[hidden], [inert]") === null;
}

/** Which layer a layer element opens. */
function layerKind(layer: Element | null): Shortcuts.Layer {
	if (layer === null) return "page";
	if (layer.matches("dialog:modal")) return "modal";
	return layer.getAttribute(SHORTCUT_SCOPE_ATTRIBUTE) === "modal" ? "modal" : "sheet";
}

/**
 * The topmost open modal: the one holding focus, or the last one in the document while
 * focus sits outside every one.
 */
function topModal(document: Document): Element | null {
	let modals = [
		...document.querySelectorAll(`dialog:modal, [${SHORTCUT_SCOPE_ATTRIBUTE}="modal"]`),
	].filter(isLayerOpen);
	if (modals.length === 0) return null;
	let active = document.activeElement;
	return (
		[...modals].reverse().find((modal) => active !== null && modal.contains(active)) ??
		modals.at(-1)!
	);
}

/**
 * Presses a declared shortcut's element: a field takes focus, anything else is clicked. A
 * disabled or inert element declines.
 */
function activate(element: HTMLElement): boolean {
	if (element.matches(":disabled, [aria-disabled='true']")) return false;
	if (element.closest("[inert]") !== null) return false;
	if (isTypingTarget(element)) {
		element.focus();
		if (element instanceof HTMLInputElement) element.select();
		return true;
	}
	element.click();
	return true;
}

/** The label a declared shortcut lists under: its own attribute, its name, or its text. */
function declaredLabel(element: Element): string {
	let declared = element.getAttribute(SHORTCUT_LABEL_ATTRIBUTE);
	if (declared !== null) return declared.trim();
	let named = element.getAttribute("aria-label") ?? element.getAttribute("title");
	return (named ?? element.textContent ?? "").trim().replace(/\s+/g, " ");
}

/** The registration a `data-shortcut` element stands for, read from the DOM as it is now. */
function declared(element: HTMLElement): Shortcuts.Registration {
	let label = declaredLabel(element);
	return {
		keys: element.getAttribute(SHORTCUT_ATTRIBUTE) ?? "",
		label: label === "" ? undefined : label,
		group:
			element.closest(`[${SHORTCUT_GROUP_ATTRIBUTE}]`)?.getAttribute(SHORTCUT_GROUP_ATTRIBUTE) ??
			undefined,
		scope: element,
		run: () => activate(element),
	};
}

/** Parses a registration's alternatives into steps. */
function compile(registration: Shortcuts.Registration, order: number): Compiled {
	return {
		registration,
		order,
		sequences: shortcutAlternatives(registration.keys).map(parseSequence),
	};
}

/**
 * Holds every shortcut on a page and answers keystrokes: the candidates a keystroke completes
 * are ranked by layer (topmost open modal, then open sheets, then the page), then priority,
 * then the latest registered, and the first that runs without declining claims the key.
 *
 * @example
 * let registry = shortcutRegistry(document);
 * registry.register({ keys: "g m", label: "Go to Monitors", group: "Navigation", run: () => location.assign("/monitors"), signal });
 */
export class ShortcutRegistry extends TypedEventTarget<Shortcuts.Events> {
	#registered: Compiled[] = [];
	#order = 0;
	#timeout: number;
	#pending: { strokes: Stroke[]; at: number } | null = null;

	/**
	 * @param options How long a sequence waits for its next key.
	 */
	constructor(options: Shortcuts.Options = {}) {
		super();
		this.#timeout = options.sequenceTimeout ?? SHORTCUT_SEQUENCE_TIMEOUT_MS;
	}

	/**
	 * Adds a shortcut until `signal` aborts or the returned function runs.
	 *
	 * @param registration The keys, what they run, and where they belong.
	 * @returns A function that removes the shortcut.
	 */
	register(registration: Shortcuts.Registration): () => void {
		let compiled = compile(registration, this.#order++);
		this.#registered.push(compiled);
		this.dispatchEvent(new Event("change"));

		let remove = () => {
			let index = this.#registered.indexOf(compiled);
			if (index === -1) return;
			this.#registered.splice(index, 1);
			this.dispatchEvent(new Event("change"));
		};

		registration.signal?.addEventListener("abort", remove, { once: true });
		return remove;
	}

	/**
	 * Every labelled shortcut, registered or declared in `document`, in registration then
	 * document order, one row per distinct keys and label.
	 *
	 * @param document The document whose `data-shortcut` elements are listed too.
	 * @returns The rows a help sheet shows.
	 */
	list(document?: Document): Shortcuts.Entry[] {
		let registrations = [
			...this.#registered.map((compiled) => compiled.registration),
			...this.#declared(document),
		];
		let seen = new Set<string>();
		let entries: Shortcuts.Entry[] = [];

		for (let registration of registrations) {
			if (registration.label === undefined) continue;
			let keys = shortcutAlternatives(registration.keys);
			let id = `${keys.join(",")}\u0000${registration.label}`;
			if (keys.length === 0 || seen.has(id)) continue;
			seen.add(id);
			entries.push({ keys, label: registration.label, group: registration.group });
		}

		return entries;
	}

	/**
	 * Answers keystrokes on `document` until `signal` aborts, in the bubble phase so a handler
	 * nearer the target that claims a key keeps it.
	 *
	 * @param document The document to listen on.
	 * @param signal Removes the listener.
	 */
	listen(document: Document, signal?: AbortSignal): void {
		document.addEventListener("keydown", (event) => this.handle(event), { signal });
	}

	/**
	 * Runs the shortcut a keystroke completes, default-preventing the keystroke when one ran or
	 * a sequence is waiting for its next key.
	 *
	 * @param event The keystroke as it reached the document.
	 * @returns Whether the keystroke was claimed.
	 */
	handle(event: KeyboardEvent): boolean {
		if (event.defaultPrevented || event.isComposing) return false;
		if (MODIFIER_KEYS.has(event.key)) return false;

		let target = event.target instanceof Node ? event.target : null;
		let document = target?.ownerDocument ?? (target instanceof Document ? target : null);
		if (document === null) return false;

		let candidates = this.#candidates(document, event);
		let pending = this.#pending;
		this.#pending = null;

		if (pending !== null && event.timeStamp - pending.at <= this.#timeout) {
			if (this.#advance(candidates, [...pending.strokes, event], event)) return true;
		}

		return this.#advance(candidates, [event], event);
	}

	/**
	 * Matches `strokes` against every candidate: a completed sequence runs, and a prefix of a
	 * longer one waits for the next key.
	 */
	#advance(
		candidates: { compiled: Compiled; rank: number }[],
		strokes: Stroke[],
		event: KeyboardEvent,
	): boolean {
		let completed: { compiled: Compiled; rank: number }[] = [];
		let waiting = false;

		for (let candidate of candidates) {
			for (let steps of candidate.compiled.sequences) {
				if (steps.length < strokes.length) continue;
				if (!strokes.every((stroke, index) => matchesStep(stroke, steps[index]!))) continue;
				if (steps.length === strokes.length) completed.push(candidate);
				else waiting = true;
			}
		}

		if (waiting) {
			this.#pending = { strokes: strokes.map(snapshot), at: event.timeStamp };
			event.preventDefault();
			return true;
		}

		completed.sort(
			(a, b) =>
				b.rank - a.rank ||
				(b.compiled.registration.priority ?? 0) - (a.compiled.registration.priority ?? 0) ||
				b.compiled.order - a.compiled.order,
		);

		for (let candidate of completed) {
			if (candidate.compiled.registration.run(event) === false) continue;
			event.preventDefault();
			return true;
		}

		return false;
	}

	/**
	 * The shortcuts able to answer this keystroke, each with its layer's rank: with a modal
	 * open only that modal's own and the global ones; otherwise the page and every open sheet.
	 */
	#candidates(document: Document, event: KeyboardEvent): { compiled: Compiled; rank: number }[] {
		let typing = isTypingTarget(event.target);
		let modal = topModal(document);
		let declared = this.#declared(document).map((registration, index) =>
			compile(registration, -1 - index),
		);
		let candidates: { compiled: Compiled; rank: number }[] = [];

		for (let compiled of [...declared, ...this.#registered]) {
			let { registration } = compiled;
			if (typing && registration.whileTyping !== true) continue;

			let scope = registration.scope ?? null;
			if (scope !== null && !scope.isConnected) continue;
			let layer = scope?.closest(LAYER_SELECTOR) ?? null;
			if (layer !== null && !isLayerOpen(layer)) continue;

			let rank: number = LAYER_RANK[layerKind(layer)];
			if (modal !== null && (layer === null || !modal.contains(layer))) {
				if (registration.global !== true) continue;
				rank = -1;
			}

			candidates.push({ compiled, rank });
		}

		return candidates;
	}

	/** The registrations every `data-shortcut` element in `document` declares. */
	#declared(document: Document | undefined): Shortcuts.Registration[] {
		if (document === undefined) return [];
		return [...document.querySelectorAll<HTMLElement>(`[${SHORTCUT_ATTRIBUTE}]`)].map(declared);
	}
}

/** Keeps the parts of a keystroke a later step compares, after the event itself is gone. */
function snapshot(stroke: Stroke): Stroke {
	let { key, ctrlKey, metaKey, altKey, shiftKey } = stroke;
	return { key, ctrlKey, metaKey, altKey, shiftKey };
}

/**
 * The registry every part on a page shares, created and bound to `document` on first use, so
 * a palette, a help sheet and a list's row keys resolve against one another.
 *
 * @param document The page's document.
 * @returns The page's registry.
 * @example shortcutRegistry(document).register({ keys: "?", label: "Show shortcuts", run: open, signal });
 */
export function shortcutRegistry(document: Document): ShortcutRegistry {
	let registry = REGISTRIES.get(document);
	if (registry !== undefined) return registry;
	registry = new ShortcutRegistry();
	registry.listen(document);
	REGISTRIES.set(document, registry);
	return registry;
}
