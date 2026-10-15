/**
 * How each prompt kind draws and reacts to keys on a terminal: a line editor for text, password
 * and number, a toggle for confirm, and a scrolling list for select, multiselect and search.
 * Each is pure state over keys; `ask.ts` owns the terminal and the loop around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Key } from "./keys.js";
import type { Choice, PromptKind, PromptKinds } from "./prompt.js";
import type { Style } from "./style.js";

import { typed } from "./keys.js";
import { normalizeChoices } from "./prompt.js";
import { graphemes } from "./style.js";

/** What a key did: answered the prompt, or found the answer wrong, or neither. */
export type Step = { submit: unknown } | { error: string } | undefined;

/** One prompt kind's state on a terminal. */
export interface Interaction {
	/** The lines under the question, the question line itself included. */
	render(style: Style, header: string): string[];
	key(key: Key): Step;
	/** The answer as the summary line prints it. */
	summary(value: unknown): string;
}

/** How many list options show at once; the rest scroll. */
const LIST_LIMIT = 10;

/** How long typed characters keep adding to a select's jump-to text. */
const JUMP_RESET_MS = 1000;

/** The interaction for `kind`, starting from `initial` (the default, or a preselection). */
export function interaction<Kind extends PromptKind>(
	kind: Kind,
	options: PromptKinds[Kind],
	initial: unknown,
): Interaction {
	switch (kind) {
		case "text":
			return line(initial, { placeholder: (options as PromptKinds["text"]).placeholder });
		case "password":
			return line(initial, { mask: (options as PromptKinds["password"]).mask ?? true });
		case "number":
			return numberLine(options as PromptKinds["number"], initial);
		case "confirm":
			return confirm(initial === true);
		case "select":
			return list((options as PromptKinds["select"]).options, initial, { mode: "one" });
		case "multiselect": {
			let multiselect = options as PromptKinds["multiselect"];
			return list(multiselect.options, initial, {
				mode: "many",
				min: multiselect.min,
				max: multiselect.max,
			});
		}
		default: {
			let search = options as PromptKinds["search"];
			return list(search.options, initial, {
				mode: search.multiple === true ? "many" : "one",
				search: true,
				placeholder: search.placeholder,
				min: search.min,
				max: search.max,
			});
		}
	}
}

/** A line of text being edited, with a cursor inside it. */
class Editor {
	chars: string[];
	cursor: number;

	/** @param text - What the line starts with */
	constructor(text = "") {
		this.chars = graphemes(text);
		this.cursor = this.chars.length;
	}

	get text(): string {
		return this.chars.join("");
	}

	/** Applies an editing key, answering whether it was one. */
	edit(key: Key, accept: (character: string) => boolean = () => true): boolean {
		let character = typed(key);
		if (character !== undefined) {
			if (!accept(character)) return false;
			this.chars.splice(this.cursor, 0, character);
			this.cursor += 1;
			return true;
		}
		if (key.name === "backspace") {
			if (this.cursor > 0) this.chars.splice(this.cursor - 1, 1);
			this.cursor = Math.max(0, this.cursor - 1);
		} else if (key.name === "delete") this.chars.splice(this.cursor, 1);
		else if (key.name === "left") this.cursor = Math.max(0, this.cursor - 1);
		else if (key.name === "right") this.cursor = Math.min(this.chars.length, this.cursor + 1);
		else if (key.name === "home" || (key.ctrl && key.name === "a")) this.cursor = 0;
		else if (key.name === "end" || (key.ctrl && key.name === "e")) this.cursor = this.chars.length;
		else if (key.ctrl && key.name === "u") {
			this.chars.splice(0, this.cursor);
			this.cursor = 0;
		} else return false;
		return true;
	}

	/** The line with the cursor drawn as an inverse cell, each character shown through `show`. */
	render(style: Style, show: (character: string) => string = (character) => character): string {
		let shown = this.chars.map(show);
		let at = shown[this.cursor] ?? " ";
		return `${shown.slice(0, this.cursor).join("")}${style.inverse(at)}${shown.slice(this.cursor + 1).join("")}`;
	}
}

/** Text and password: a line editor whose empty answer takes `initial`. */
function line(
	initial: unknown,
	options: { placeholder?: string | undefined; mask?: boolean },
): Interaction {
	let editor = new Editor();
	let fallback = typeof initial === "string" ? initial : undefined;
	let secret = options.mask !== undefined;
	return {
		render(style, header) {
			if (editor.chars.length === 0) {
				let hint = secret ? undefined : (fallback ?? options.placeholder);
				let shown = hint === undefined ? style.inverse(" ") : style.dim(hint);
				return [`${header} › ${shown}`];
			}
			if (secret && options.mask === false) return [`${header} › `];
			let value = secret ? editor.render(style, () => "•") : editor.render(style);
			return [`${header} › ${value}`];
		},
		key(key) {
			if (key.name === "return") {
				return {
					submit: editor.chars.length === 0 && fallback !== undefined ? fallback : editor.text,
				};
			}
			editor.edit(key);
			return undefined;
		},
		summary(value) {
			if (!secret) return String(value);
			return options.mask === false ? "" : "•".repeat(graphemes(String(value)).length);
		},
	};
}

/** Number: digits, `-` and `.`, with the arrows stepping by `step` within `min` and `max`. */
function numberLine(options: PromptKinds["number"], initial: unknown): Interaction {
	let editor = new Editor();
	let fallback = typeof initial === "number" ? initial : undefined;
	let step = options.step ?? 1;
	let clamp = (value: number) =>
		Math.min(options.max ?? Infinity, Math.max(options.min ?? -Infinity, value));
	return {
		render(style, header) {
			if (editor.chars.length === 0) {
				let shown = fallback === undefined ? style.inverse(" ") : style.dim(String(fallback));
				return [`${header} › ${shown}`];
			}
			return [`${header} › ${editor.render(style)}`];
		},
		key(key) {
			if (key.name === "up" || key.name === "down") {
				let current = editor.text === "" ? (fallback ?? options.min ?? 0) : Number(editor.text);
				if (Number.isNaN(current)) current = fallback ?? 0;
				let next =
					editor.text === "" && fallback === undefined
						? current
						: current + (key.name === "up" ? step : -step);
				editor = new Editor(String(clamp(next)));
				return undefined;
			}
			if (key.name === "return") {
				if (editor.text === "") {
					return fallback === undefined ? { error: "Enter a number" } : { submit: fallback };
				}
				let value = Number(editor.text);
				if (Number.isNaN(value)) return { error: "Enter a number" };
				if (options.min !== undefined && value < options.min) {
					return { error: `Enter a number of at least ${options.min}` };
				}
				if (options.max !== undefined && value > options.max) {
					return { error: `Enter a number of at most ${options.max}` };
				}
				return { submit: value };
			}
			editor.edit(key, (character) => /^[\d.-]$/.test(character));
			return undefined;
		},
		summary: (value) => String(value),
	};
}

/** Yes or no: `y` and `n` answer at once, the arrows switch, and Enter takes the current one. */
function confirm(initial: boolean): Interaction {
	let value = initial;
	return {
		render(style, header) {
			let yes = value ? style.cyan(style.underline("Yes")) : style.dim("Yes");
			let no = value ? style.dim("No") : style.cyan(style.underline("No"));
			let marker = value ? "(Y/n)" : "(y/N)";
			return [
				`${header} ${style.dim(marker)} › ${value ? "●" : "○"} ${yes} / ${value ? "○" : "●"} ${no}`,
			];
		},
		key(key) {
			if (key.name === "y") return { submit: true };
			if (key.name === "n") return { submit: false };
			if (key.name === "return") return { submit: value };
			if (["left", "right", "up", "down", "tab"].includes(key.name)) value = !value;
			return undefined;
		},
		summary: (answer) => (answer === true ? "Yes" : "No"),
	};
}

/** How a list prompt answers. */
interface ListMode {
	mode: "one" | "many";
	search?: boolean;
	placeholder?: string | undefined;
	min?: number | undefined;
	max?: number | undefined;
}

/**
 * Select, multiselect and search: a cursor over the options (only the ones matching the typed
 * query, for search), skipping disabled ones, with Space toggling when the answer is a list.
 */
function list(choices: readonly unknown[], initial: unknown, mode: ListMode): Interaction {
	let options = normalizeChoices(choices as readonly Choice<unknown>[]);
	let selected = new Set<number>();
	if (mode.mode === "many" && Array.isArray(initial)) {
		options.forEach((option, index) => {
			if (initial.some((value) => Object.is(value, option.value))) selected.add(index);
		});
	}
	let query = new Editor();
	let jump = "";
	let jumpedAt = 0;

	/** The options the query matches, as indices into `options`. */
	let visible = (): number[] => {
		let needle = query.text.toLowerCase();
		return options
			.map((_, index) => index)
			.filter((index) => {
				if (mode.search !== true || needle === "") return true;
				let option = options[index] as (typeof options)[number];
				return (
					option.label.toLowerCase().includes(needle) ||
					String(option.value).toLowerCase().includes(needle)
				);
			});
	};

	let initialIndex = options.findIndex(
		(option) => !option.disabled && mode.mode === "one" && Object.is(option.value, initial),
	);
	let cursor = initialIndex === -1 ? options.findIndex((option) => !option.disabled) : initialIndex;

	/** Moves the cursor `by` positions through the matching enabled options, wrapping around. */
	let move = (by: number) => {
		let shown = visible().filter((index) => !(options[index] as (typeof options)[number]).disabled);
		if (shown.length === 0) return;
		let at = shown.indexOf(cursor);
		let next = at === -1 ? 0 : (at + by + shown.length) % shown.length;
		cursor = shown[next] as number;
	};

	/** Puts the cursor on the first match after the query changed. */
	let settle = () => {
		let shown = visible().filter((index) => !(options[index] as (typeof options)[number]).disabled);
		if (!shown.includes(cursor)) cursor = shown[0] ?? -1;
	};

	let labels = (value: unknown): string => {
		let values = Array.isArray(value) ? value : [value];
		return values
			.map((each) => options.find((option) => Object.is(option.value, each))?.label ?? String(each))
			.join(", ");
	};

	return {
		render(style, header) {
			let lines: string[] = [];
			if (mode.search === true) {
				let shownQuery =
					query.chars.length === 0
						? mode.placeholder === undefined
							? style.inverse(" ")
							: style.dim(mode.placeholder)
						: query.render(style);
				lines.push(`${header} › ${shownQuery}`);
			} else lines.push(header);
			let shown = visible();
			if (shown.length === 0) {
				lines.push(style.dim("  No option matches"));
				return lines;
			}
			let at = Math.max(0, shown.indexOf(cursor));
			let start = Math.min(
				Math.max(0, at - Math.floor(LIST_LIMIT / 2)),
				Math.max(0, shown.length - LIST_LIMIT),
			);
			let window = shown.slice(start, start + LIST_LIMIT);
			if (start > 0) lines.push(style.dim(`  ↑ ${start} more`));
			for (let index of window) {
				let option = options[index] as (typeof options)[number];
				let pointer = index === cursor ? style.cyan("❯") : " ";
				let box = mode.mode === "many" ? `${selected.has(index) ? style.green("◉") : "◯"} ` : "";
				let label = option.disabled
					? style.dim(`${option.label} (disabled)`)
					: index === cursor
						? style.cyan(option.label)
						: option.label;
				let hint = option.hint === "" ? "" : ` ${style.dim(option.hint)}`;
				lines.push(`${pointer} ${box}${label}${hint}`);
			}
			let below = shown.length - start - window.length;
			if (below > 0) lines.push(style.dim(`  ↓ ${below} more`));
			return lines;
		},
		key(key) {
			if (key.name === "up") move(-1);
			else if (key.name === "down" || key.name === "tab") move(1);
			else if (key.name === "home" && mode.search !== true) {
				cursor = -1;
				move(1);
			} else if (key.name === "end" && mode.search !== true) {
				cursor = -1;
				move(-1);
			} else if (key.name === "space" && mode.mode === "many") {
				let option = options[cursor];
				if (option !== undefined && !option.disabled) {
					if (selected.has(cursor)) selected.delete(cursor);
					else selected.add(cursor);
				}
			} else if (key.name === "a" && !key.ctrl && mode.mode === "many" && mode.search !== true) {
				let enabled = options
					.map((_, index) => index)
					.filter((index) => !(options[index] as (typeof options)[number]).disabled);
				let all = enabled.every((index) => selected.has(index));
				for (let index of enabled) {
					if (all) selected.delete(index);
					else selected.add(index);
				}
			} else if (key.name === "return") {
				if (mode.mode === "one") {
					let option = options[cursor];
					if (option === undefined || option.disabled || !visible().includes(cursor)) {
						return { error: "No option matches" };
					}
					return { submit: option.value };
				}
				let values = options
					.filter((_, index) => selected.has(index))
					.map((option) => option.value);
				if (mode.min !== undefined && values.length < mode.min) {
					return { error: `Select at least ${mode.min}` };
				}
				if (mode.max !== undefined && values.length > mode.max) {
					return { error: `Select at most ${mode.max}` };
				}
				return { submit: values };
			} else if (mode.search === true) {
				if (query.edit(key)) settle();
			} else {
				let character = typed(key);
				if (character !== undefined) {
					let now = Date.now();
					jump = now - jumpedAt > JUMP_RESET_MS ? character : jump + character;
					jumpedAt = now;
					let needle = jump.toLowerCase();
					let match = options.findIndex(
						(option) => !option.disabled && option.label.toLowerCase().startsWith(needle),
					);
					if (match !== -1) cursor = match;
				}
			}
			return undefined;
		},
		summary: labels,
	};
}
