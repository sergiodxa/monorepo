/**
 * The player's theme: every visual decision of its parts as a `--novel-*` custom property with a
 * default, so a game restyles the player by setting variables on `NovelPlayer` (or any ancestor)
 * with `css()`, images and image frames included, instead of overriding the parts' rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every theme variable and its default. A default may read another variable or an `@sdxc/ui`
 * theme token, so setting `--novel-accent` recolors every accent at once. Background variables
 * take any `<image>` or gradient, and `*-border-image-*` ones frame a part with an image.
 *
 * @example css({ "--novel-textbox-border-image-source": "url(/frame.png)", "--novel-textbox-border-image-width": "24px" })
 */
export const NOVEL_THEME_VARIABLES = {
	"--novel-letterbox": "#000",
	"--novel-color": "#fff",
	"--novel-accent": "#f4c95d",
	"--novel-stage-background": "#000",
	"--novel-transition-duration": "600ms",
	"--novel-transition-easing": "ease",
	"--novel-character-height": "95%",
	"--novel-character-duration": "400ms",
	"--novel-character-easing": "ease",
	"--novel-focus-duration": "200ms",
	"--novel-focus-scale": "1.05",
	"--novel-focus-lift": "0%",
	"--novel-focus-filter": "none",
	"--novel-dim-brightness": "0.6",
	"--novel-dim-filter": "brightness(var(--novel-dim-brightness, 0.6))",
	"--novel-text-font": "var(--ui-font-sans, inherit)",
	"--novel-text-size": "calc(3.4cqh * var(--novel-font-scale, 1))",
	"--novel-text-leading": "1.45",
	"--novel-text-tracking": "normal",
	"--novel-text-word-spacing": "normal",
	"--novel-text-color": "inherit",
	"--novel-text-shadow": "none",
	"--novel-textbox-background": "rgb(10 10 20 / 0.78)",
	"--novel-textbox-color": "#fff",
	"--novel-textbox-border": "none",
	"--novel-textbox-border-image-source": "none",
	"--novel-textbox-border-image-slice": "100%",
	"--novel-textbox-border-image-width": "1",
	"--novel-textbox-border-image-outset": "0",
	"--novel-textbox-border-image-repeat": "stretch",
	"--novel-textbox-padding": "2.4cqh 3cqw",
	"--novel-textbox-radius": "1.4cqh",
	"--novel-textbox-shadow": "none",
	"--novel-textbox-backdrop-filter": "none",
	"--novel-textbox-position": "absolute",
	"--novel-textbox-inset": "auto 4cqw 3cqh",
	"--novel-textbox-max-inline-size": "none",
	"--novel-textbox-min-block-size": "24cqh",
	"--novel-nameplate-background": "transparent",
	"--novel-nameplate-border-image-source": "none",
	"--novel-nameplate-border-image-slice": "100%",
	"--novel-nameplate-border-image-width": "1",
	"--novel-nameplate-padding": "0",
	"--novel-nameplate-radius": "0",
	"--novel-nameplate-font-family": "inherit",
	"--novel-nameplate-font-size": "1em",
	"--novel-nameplate-font-weight": "700",
	"--novel-nameplate-color": "inherit",
	"--novel-nameplate-offset": "0 0",
	"--novel-nameplate-margin": "0 0 0.6cqh",
	"--novel-next-content": '"▼"',
	"--novel-next-image": "none",
	"--novel-next-size": "0.7em",
	"--novel-next-color": "var(--novel-accent, #f4c95d)",
	"--novel-next-animation": "novel-next 1s ease-in-out infinite alternate",
	"--novel-choices-gap": "2cqh",
	"--novel-prompt-background": "rgb(0 0 0 / 0.6)",
	"--novel-prompt-color": "#fff",
	"--novel-option-background": "rgb(20 20 40 / 0.85)",
	"--novel-option-color": "#fff",
	"--novel-option-border": "0.2cqh solid rgb(255 255 255 / 0.35)",
	"--novel-option-border-image-source": "none",
	"--novel-option-border-image-slice": "100%",
	"--novel-option-border-image-width": "1",
	"--novel-option-radius": "1.2cqh",
	"--novel-option-padding": "1.4cqh 3cqw",
	"--novel-option-min-inline-size": "46cqw",
	"--novel-option-hover": "rgb(60 60 110 / 0.95)",
	"--novel-option-hover-color": "var(--novel-option-color, #fff)",
	"--novel-option-hover-border-color": "var(--novel-accent, #f4c95d)",
	"--novel-option-focus-outline": "none",
	"--novel-option-disabled-opacity": "0.5",
	"--novel-chosen-color": "#b8b8d0",
	"--novel-countdown-track": "rgb(255 255 255 / 0.25)",
	"--novel-countdown-fill": "var(--novel-accent, #f4c95d)",
	"--novel-countdown-height": "0.8cqh",
	"--novel-menu-background": "transparent",
	"--novel-menu-padding": "0",
	"--novel-menu-radius": "0",
	"--novel-menu-inset": "auto 5cqw 3.6cqh auto",
	"--novel-menu-font-size": "2.2cqh",
	"--novel-menu-color": "rgb(255 255 255 / 0.75)",
	"--novel-menu-active-color": "var(--novel-accent, #f4c95d)",
	"--novel-dialog-background": "var(--ui-neutral-bg-tint)",
	"--novel-dialog-color": "var(--ui-neutral-fg-emphasis)",
	"--novel-dialog-border-image-source": "none",
	"--novel-dialog-border-image-slice": "100%",
	"--novel-dialog-border-image-width": "1",
	"--novel-caption-background": "rgb(0 0 0 / 0.65)",
	"--novel-caption-color": "#fff",
	"--novel-ending-background": "rgb(0 0 0 / 0.55)",
	"--novel-ending-size": "6cqh",
	"--novel-ending-button-background": "rgb(0 0 0 / 0.4)",
	"--novel-ending-button-color": "#fff",
	"--novel-ending-button-border": "1px solid var(--novel-accent, #f4c95d)",
	"--novel-error-background": "rgb(120 20 30 / 0.9)",
	"--novel-read-color": "inherit",
	"--novel-notification-inset": "1rem 1rem auto auto",
	"--novel-notification-gap": "0.5rem",
	"--novel-notification-background": "rgb(10 10 20 / 0.88)",
	"--novel-notification-color": "#fff",
	"--novel-notification-border": "1px solid var(--novel-accent, #f4c95d)",
	"--novel-notification-radius": "0.5rem",
	"--novel-notification-padding": "0.6rem 1rem",
	"--novel-notification-font": "var(--ui-font-sans, inherit)",
	"--novel-notification-font-size": "0.95rem",
	"--novel-notification-shadow": "0 0.25rem 1rem rgb(0 0 0 / 0.4)",
	"--novel-notification-animation": "novel-notification-in 250ms ease-out",
} as const;

/** The name of one of the player's theme variables. */
export type NovelThemeVariable = keyof typeof NOVEL_THEME_VARIABLES;

/**
 * Reads a theme variable with its default, for a part's styles.
 *
 * @example themeVar("--novel-accent"); // "var(--novel-accent, #f4c95d)"
 */
export function themeVar(name: NovelThemeVariable): string {
	return `var(${name}, ${NOVEL_THEME_VARIABLES[name]})`;
}

/**
 * The inline surface of a player dialog: its background, color and image frame, read from the
 * theme so a game restyles every screen at once.
 */
export function dialogSurface(): Record<string, string> {
	return {
		background: themeVar("--novel-dialog-background"),
		color: themeVar("--novel-dialog-color"),
		borderImageSource: themeVar("--novel-dialog-border-image-source"),
		borderImageSlice: themeVar("--novel-dialog-border-image-slice"),
		borderImageWidth: themeVar("--novel-dialog-border-image-width"),
	};
}
