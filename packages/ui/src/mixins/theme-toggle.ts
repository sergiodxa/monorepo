/**
 * Switches a theme switch control's page-wide scheme — light, dark, or
 * system — and persists it in a cookie so a return visit's server render
 * starts in the same mode. The mode must reach `<html>`, outside the
 * control, and answer Invoker Commands, neither of which CSS expresses alone.
 * Without JS the same options still work as a plain form writing the cookie.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

import { asCommandEvent } from "../utils/command-event.js";
import { writeCookie } from "../utils/write-cookie.js";

/**
 * Cookie {@link themeToggle} persists the active mode under by default, so
 * an app's server-side render can read the same name back; override via
 * {@link ThemeToggle.Options.cookieName} for a different name.
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
	 * A color scheme {@link themeToggle} can switch `<html>` to: `"light"`
	 * removes `.dark`/`.system` for the light palette, `"dark"` adds `.dark`,
	 * and `"system"` adds `.system` to follow `prefers-color-scheme`.
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
 * Dispatched on a theme switch control by {@link themeToggle} right after a
 * switch, carrying the new mode so a consumer can resync another instance or
 * update `<meta name="theme-color">` without reading `<html>`'s class list.
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
 * switches `<html>` to, or `undefined` for any other command, letting an
 * unrelated `command` event on the same host pass through untouched.
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
 * names none of the three modes {@link themeToggle} recognizes, keeping an
 * unrelated control's `change` event from ever reaching {@link applyMode}.
 *
 * @param value Raw `value` read off a native radio input or `<select>`.
 */
function parseMode(value: string): ThemeToggle.Mode | undefined {
	if (value === "light" || value === "dark" || value === "system") return value;
	return undefined;
}

/**
 * Reads the `value` a `change` event's target carries when that target
 * is a radio input or `<select>`, or `undefined` otherwise, so a `change`
 * from an unrelated descendant never reaches {@link parseMode}.
 *
 * @param target `EventTarget` a `change` event fired on.
 */
function readControlValue(target: EventTarget | null): string | undefined {
	if (target instanceof HTMLInputElement && target.type === "radio") return target.value;
	if (target instanceof HTMLSelectElement) return target.value;
	return undefined;
}

/**
 * Switches `<html>` to `mode`, following `theme.css`'s contract: `.dark`
 * for a forced dark palette, `.system` for `prefers-color-scheme`, or
 * neither class for a forced light palette.
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
 * change, switching `<html>` and persisting the mode to a cookie together,
 * every time, so `<html>`'s class list stays the only source of truth.
 *
 * @param options Cookie name to persist the mode under; see
 * {@link ThemeToggle.Options}. Optional — when a call site omits it
 * (`themeToggle()`), the runtime passes its trailing current-props argument
 * in its place, so that value is reset back to an empty options object.
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
