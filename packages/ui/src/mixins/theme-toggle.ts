/**
 * Switches a theme switch control's page-wide color scheme — forced light,
 * forced dark, or following the operating system — and remembers the choice
 * so a returning visit starts already in the same scheme. Answers three
 * invoker commands from separate trigger buttons, and reacts the same way to
 * a native `change` bubbling up from a descendant radio input or `<select>`,
 * so either markup shape drives the same switch.
 *
 * Why JS: the mode a visitor picks has to reach `<html>` — an element
 * outside the control's own subtree — and a cookie the next full
 * navigation's server render can read back before any markup arrives; it
 * also has to answer the `--ui-theme-light`/`--ui-theme-dark`/
 * `--ui-theme-system` commands dispatched by a separate trigger button.
 * Neither a class change on a different element nor a cookie write nor the
 * Command Invoker API's `command` event has an HTML attribute or CSS
 * selector standing in for it.
 * No-JS baseline: the light/dark/system options still render as an
 * ordinary, mutually exclusive set of native controls inside a form, and
 * submitting that form still reaches the server, which is just as capable
 * of writing the same cookie and rendering the next page with the right
 * class already on `<html>`. Only the instant, submit-free retheme is
 * unavailable without this mixin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { asCommandEvent } from "../utils/command-event";
import { writeCookie } from "../utils/write-cookie";

/**
 * Cookie {@link themeToggle} persists the active mode under by default, so
 * an app's server-side render can read the same name back. Override via
 * {@link ThemeToggle.Options.cookieName} only if the server reads the
 * cookie back under a different name.
 */
const THEME_COOKIE_NAME = "ui:theme";

/** Invoker command {@link themeToggle} answers to force the light palette. */
const LIGHT_COMMAND = "--ui-theme-light" as const;

/** Invoker command {@link themeToggle} answers to force the dark palette. */
const DARK_COMMAND = "--ui-theme-dark" as const;

/** Invoker command {@link themeToggle} answers to follow the operating system's `prefers-color-scheme`. */
const SYSTEM_COMMAND = "--ui-theme-system" as const;

/** DOM event type dispatched by {@link themeToggle} whenever it switches `<html>`'s active mode. */
const THEME_CHANGE_EVENT = "ui:theme-change" as const;

declare global {
	interface HTMLElementEventMap {
		[THEME_CHANGE_EVENT]: ThemeChangeEvent;
	}
}

/**
 * Types associated with {@link themeToggle}: the color-scheme modes it
 * switches `<html>` between, and the options it accepts.
 */
export namespace ThemeToggle {
	/**
	 * A color scheme {@link themeToggle} can switch `<html>` to. `"light"`
	 * removes both `.dark` and `.system`, forcing the light palette;
	 * `"dark"` adds `.dark`, forcing the dark palette; `"system"` adds
	 * `.system`, following the operating system's `prefers-color-scheme`.
	 */
	export type Mode = "light" | "dark" | "system";

	/**
	 * Configuration accepted by {@link themeToggle}.
	 */
	export interface Options {
		/**
		 * Cookie name the active mode persists under. Defaults to
		 * `"ui:theme"` — override only if the consuming app's server reads
		 * the cookie back under a different name.
		 */
		cookieName?: string;
	}
}

/**
 * Dispatched on a theme switch control by {@link themeToggle} right after it
 * switches `<html>`'s active mode — from either the invoker command or the
 * native `change` path — carrying the mode it switched to, so a consumer
 * can react (resyncing another switch instance rendered elsewhere on the
 * page, updating a `<meta name="theme-color">` tag) without reading
 * `<html>`'s class list back off the DOM itself.
 */
export class ThemeChangeEvent extends Event {
	/** The mode {@link themeToggle} just switched `<html>` to. */
	readonly mode: ThemeToggle.Mode;

	/**
	 * @param mode The mode {@link themeToggle} just switched `<html>` to.
	 */
	constructor(mode: ThemeToggle.Mode) {
		super(THEME_CHANGE_EVENT, { bubbles: true });
		this.mode = mode;
	}
}

/**
 * Maps an invoker command {@link themeToggle} answers to the mode it
 * switches `<html>` to, or `undefined` for any other command — the guard
 * that lets an unrelated `command` event bubbling through the same host
 * pass through untouched.
 *
 * @param command `CommandEvent.command` read off a `command` event.
 */
function commandToMode(command: string): ThemeToggle.Mode | undefined {
	switch (command) {
		case LIGHT_COMMAND:
			return "light";
		case DARK_COMMAND:
			return "dark";
		case SYSTEM_COMMAND:
			return "system";
		default:
			return undefined;
	}
}

/**
 * Reads `value` back as a {@link ThemeToggle.Mode}, or `undefined` when it
 * names none of the three modes {@link themeToggle} recognizes — the guard
 * that keeps an unrelated control's `change` event, one that happens to
 * bubble through the same host, from ever reaching {@link applyMode}.
 *
 * @param value Raw `value` read off a native radio input or `<select>`.
 */
function parseMode(value: string): ThemeToggle.Mode | undefined {
	if (value === "light" || value === "dark" || value === "system") return value;
	return undefined;
}

/**
 * Reads the `value` a `change` event's target carries, when that target is
 * a radio input or a `<select>` — the two native controls whose `value`
 * can name a mode — or `undefined` for anything else, so a `change`
 * bubbling from an unrelated descendant never reaches {@link parseMode}.
 *
 * @param target `EventTarget` a `change` event fired on.
 */
function readControlValue(target: EventTarget | null): string | undefined {
	if (target instanceof HTMLInputElement && target.type === "radio") return target.value;
	if (target instanceof HTMLSelectElement) return target.value;
	return undefined;
}

/**
 * Switches `<html>` to `mode`, following `theme.css`'s own contract for
 * which class each mode expects: `.dark` for a forced dark palette,
 * `.system` for the operating system's `prefers-color-scheme`, or neither
 * class for a forced light palette.
 *
 * @param mode Mode to switch `<html>` to.
 */
function applyMode(mode: ThemeToggle.Mode): void {
	let root = document.documentElement;
	root.classList.toggle("dark", mode === "dark");
	root.classList.toggle("system", mode === "system");
}

/**
 * Turns a theme switch control into the source of a page-wide color-scheme
 * change: switches `<html>` to light, dark, or system, and persists the
 * choice into a cookie, so the next full navigation's server render starts
 * `<html>` in the same mode ahead of hydration. `<html>`'s own class list
 * stays the single source of truth for the mode currently active — this
 * mixin never keeps a copy of its own; it only ever computes the next mode
 * and writes both `<html>` and the cookie together, every time.
 *
 * Answers three invoker commands from any trigger targeting the host —
 * `--ui-theme-light`, `--ui-theme-dark`, `--ui-theme-system` — so three
 * plain buttons can drive the switch without the host itself carrying a
 * value. Also reacts to a native `change` bubbling up from a descendant
 * radio input or `<select>` whose `value` already names a mode, so a
 * form-native set of options switches the scheme the same way, with no
 * invoker commands involved at all.
 *
 * Dispatches {@link ThemeChangeEvent} on the host after every switch, from
 * either path.
 *
 * @param options Cookie name to persist the mode under; see {@link ThemeToggle.Options}.
 * @returns A mixin descriptor for a theme switch control's `mix` prop.
 * @example
 * <div id="theme-switch" mix={[themeToggle()]}>
 * 	<button commandfor="theme-switch" command="--ui-theme-light">{t("theme.light")}</button>
 * 	<button commandfor="theme-switch" command="--ui-theme-dark">{t("theme.dark")}</button>
 * 	<button commandfor="theme-switch" command="--ui-theme-system">{t("theme.system")}</button>
 * </div>
 * @example
 * // A form-native radio group, still fully functional as a plain form
 * // submission when JavaScript never runs.
 * <fieldset mix={[themeToggle()]}>
 * 	<legend>{t("theme.label")}</legend>
 * 	<label><input type="radio" name="theme" value="light" defaultChecked /> {t("theme.light")}</label>
 * 	<label><input type="radio" name="theme" value="dark" /> {t("theme.dark")}</label>
 * 	<label><input type="radio" name="theme" value="system" /> {t("theme.system")}</label>
 * </fieldset>
 */
export const themeToggle: MixinFactory<HTMLElement, [options?: ThemeToggle.Options], ElementProps> =
	createMixin<HTMLElement, [options?: ThemeToggle.Options], ElementProps>((handle) => {
		return (options = {}, props = options as ElementProps) => {
			// `options` is optional, so a call site that omits it (`themeToggle()`)
			// gets the runtime's trailing current-props argument in its place —
			// reset it back to an empty options object when that happens.
			if (props === options) {
				options = {};
			}

			let cookieName = options.cookieName ?? THEME_COOKIE_NAME;

			return createElement(handle.element, {
				mix: [
					on<HTMLElement, "command">("command", (event) => {
						let commandEvent = asCommandEvent(event);
						let mode = commandToMode(commandEvent.command);
						if (mode === undefined) return;

						applyMode(mode);
						writeCookie(cookieName, mode);
						event.currentTarget.dispatchEvent(new ThemeChangeEvent(mode));
					}),
					on<HTMLElement, "change">("change", (event) => {
						let value = readControlValue(event.target);
						if (value === undefined) return;

						let mode = parseMode(value);
						if (mode === undefined) return;

						applyMode(mode);
						writeCookie(cookieName, mode);
						event.currentTarget.dispatchEvent(new ThemeChangeEvent(mode));
					}),
				],
			});
		};
	});
