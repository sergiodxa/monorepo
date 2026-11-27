/**
 * The player's theme: every visual decision of its parts as a `--novel-*` custom property with a
 * default, so a game restyles the player by setting variables on `NovelPlayer` (or any ancestor)
 * with `css()`, images and image frames included, instead of overriding the parts' rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every theme variable and its default. A default may read another variable, an `@sdxc/ui` token,
 * or `--novel-character-color`, the color a character declares; backgrounds take any `<image>`,
 * and `*-border-image-*` frame a part with an image. `@sdxc/ui` controls in dialogs follow them.
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
	"--novel-next-inset": "2.4cqh 1.6cqw auto auto",
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
	"--novel-dialog-accent": "var(--novel-accent, #f4c95d)",
	"--novel-dialog-on-accent": "#fff",
	"--novel-dialog-line": "var(--ui-neutral-border)",
	"--novel-dialog-field": "var(--ui-neutral-bg-tint)",
	"--novel-dialog-border": "1px solid transparent",
	"--novel-dialog-shadow":
		"var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)",
	"--novel-dialog-font": "inherit",
	"--novel-dialog-font-size": "1rem",
	"--novel-dialog-title-font": "inherit",
	"--novel-dialog-title-weight": "600",
	"--novel-dialog-title-tracking": "var(--ui-tracking-tight, -0.025em)",
	"--novel-dialog-title-color": "var(--novel-dialog-color, var(--ui-neutral-fg-emphasis))",
	"--novel-dialog-border-image-source": "none",
	"--novel-dialog-border-image-slice": "100%",
	"--novel-dialog-border-image-width": "1",
	"--novel-settings-panel-background": "transparent",
	"--novel-settings-panel-color": "inherit",
	"--novel-settings-panel-padding": "0.25rem 1rem",
	"--novel-settings-panel-border": "none",
	"--novel-settings-panel-shadow": "none",
	"--novel-settings-panel-accent": "var(--novel-dialog-accent, var(--novel-accent, #f4c95d))",
	"--novel-settings-panel-on-accent": "var(--novel-dialog-on-accent, #fff)",
	"--novel-settings-panel-line": "rgb(127 127 127 / 0.45)",
	"--novel-settings-panel-field": "var(--novel-dialog-field, var(--ui-neutral-bg-tint))",
	"--novel-settings-divider": "rgb(127 127 127 / 0.25)",
	"--novel-settings-readout-color": "inherit",
	"--novel-settings-tab-background": "transparent",
	"--novel-settings-tab-color": "inherit",
	"--novel-settings-tab-border": "1px solid rgb(127 127 127 / 0.3)",
	"--novel-settings-tab-radius": "0.4rem",
	"--novel-settings-tab-font": "inherit",
	"--novel-settings-tab-tracking": "normal",
	"--novel-settings-tab-shadow": "none",
	"--novel-settings-tab-selected-background": "rgb(127 127 127 / 0.25)",
	"--novel-settings-tab-selected-color": "inherit",
	"--novel-settings-slider-track": "rgb(127 127 127 / 0.55)",
	"--novel-settings-slider-track-thickness": "2px",
	"--novel-settings-preview-background": "var(--novel-textbox-background, rgb(10 10 20 / 0.78))",
	"--novel-settings-preview-color": "var(--novel-textbox-color, #fff)",
	"--novel-settings-preview-border": "none",
	"--novel-settings-preview-font-style": "normal",
	"--novel-library-frame": "1px solid rgb(127 127 127 / 0.45)",
	"--novel-library-radius": "0.4rem",
	"--novel-library-locked-background": "rgb(127 127 127 / 0.12)",
	"--novel-library-locked-color": "rgb(127 127 127)",
	"--novel-character-name-color": "var(--novel-character-color, currentColor)",
	"--novel-encyclopedia-tab-font": "var(--novel-settings-tab-font, inherit)",
	"--novel-encyclopedia-tab-tracking": "var(--novel-settings-tab-tracking, normal)",
	"--novel-encyclopedia-page-padding": "1rem 1.5rem",
	"--novel-encyclopedia-page-background": "var(--novel-settings-panel-background, transparent)",
	"--novel-encyclopedia-page-color": "var(--novel-settings-panel-color, inherit)",
	"--novel-encyclopedia-page-border": "var(--novel-settings-panel-border, none)",
	"--novel-encyclopedia-page-radius": "0",
	"--novel-encyclopedia-page-shadow": "var(--novel-settings-panel-shadow, none)",
	"--novel-encyclopedia-columns": "minmax(10rem, 2fr) minmax(0, 3fr)",
	"--novel-encyclopedia-column-gap": "1.5rem",
	"--novel-encyclopedia-title-weight": "revert-layer",
	"--novel-encyclopedia-topic-font": "var(--novel-dialog-title-font, inherit)",
	"--novel-encyclopedia-topic-color": "inherit",
	"--novel-encyclopedia-contents-color": "inherit",
	"--novel-encyclopedia-search-font-style": "normal",
	"--novel-encyclopedia-current-background": "rgb(127 127 127 / 0.2)",
	"--novel-encyclopedia-current-color": "inherit",
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
	"--novel-title-background":
		"radial-gradient(circle at 70% 35%, rgb(70 60 130 / 0.55), transparent 60%), linear-gradient(160deg, #141428, #05050c)",
	"--novel-title-background-filter": "none",
	"--novel-title-background-position": "center",
	"--novel-title-art-inset": "auto 4cqw 0 auto",
	"--novel-title-art-block-size": "95cqh",
	"--novel-title-art-filter": "none",
	"--novel-title-art-animation": "none",
	"--novel-title-color": "#fff",
	"--novel-title-font": "var(--ui-font-sans, inherit)",
	"--novel-title-overlay": "linear-gradient(90deg, rgb(0 0 0 / 0.6), rgb(0 0 0 / 0) 60%)",
	"--novel-title-inset": "8cqh auto 8cqh 7cqw",
	"--novel-title-align": "flex-start",
	"--novel-title-justify": "center",
	"--novel-title-gap": "5cqh",
	"--novel-title-heading-font": 'Georgia, "Times New Roman", serif',
	"--novel-title-heading-size": "9cqh",
	"--novel-title-heading-weight": "600",
	"--novel-title-heading-color": "var(--novel-accent, #f4c95d)",
	"--novel-title-heading-shadow": "0 0.4cqh 1.6cqh rgb(0 0 0 / 0.6)",
	"--novel-title-logo-max-inline-size": "100%",
	"--novel-title-logo-max-block-size": "30cqh",
	"--novel-title-logo-filter": "none",
	"--novel-title-menu-gap": "1.6cqh",
	"--novel-title-button-background": "rgb(20 20 40 / 0.85)",
	"--novel-title-button-color": "#fff",
	"--novel-title-button-border": "0.2cqh solid rgb(255 255 255 / 0.35)",
	"--novel-title-button-radius": "1.2cqh",
	"--novel-title-button-padding": "1.4cqh 3cqw",
	"--novel-title-button-font-size": "2.6cqh",
	"--novel-title-button-min-inline-size": "28cqw",
	"--novel-title-button-hover": "rgb(60 60 110 / 0.95)",
	"--novel-title-button-hover-border-color": "var(--novel-accent, #f4c95d)",
	"--novel-title-fullscreen-inset": "1.5cqh",
	"--novel-title-fullscreen-size": "max(2.25rem, 5cqh)",
	"--novel-title-fullscreen-border": "none",
	"--novel-title-fullscreen-radius": "0.4rem",
	"--novel-title-fullscreen-background": "rgb(0 0 0 / 0.35)",
	"--novel-title-fullscreen-color": "var(--novel-title-color, #fff)",
	"--novel-title-button-font-family": "inherit",
	"--novel-title-button-font-weight": "inherit",
	"--novel-title-button-letter-spacing": "normal",
	"--novel-title-button-text-transform": "none",
	"--novel-title-button-font-variant": "normal",
	"--novel-title-button-shadow": "none",
	"--novel-title-button-hover-shadow": "var(--novel-title-button-shadow, none)",
	"--novel-title-button-hover-translate": "none",
	"--novel-title-detail-font-family": "inherit",
	"--novel-title-detail-font-size": "0.7em",
	"--novel-title-detail-color": "rgb(255 255 255 / 0.75)",
	"--novel-title-detail-letter-spacing": "normal",
	"--novel-title-detail-text-transform": "none",
	"--novel-title-detail-time-color": "inherit",
	"--novel-title-footer-font-size": "1.5cqh",
	"--novel-title-footer-leading": "1.45",
	"--novel-title-footer-color": "rgb(255 255 255 / 0.6)",
	"--novel-title-footer-gap": "2cqh",
	"--novel-title-footer-max-inline-size": "36cqw",
	"--novel-title-footer-align": "start",
} as const;

/** The name of one of the player's theme variables. */
export type NovelThemeVariable = keyof typeof NOVEL_THEME_VARIABLES;

/** Theme variables a game sets, by their full custom property names. */
export interface NovelTheme extends Partial<Record<NovelThemeVariable, string | number>> {}

/**
 * Collects theme variables into a style object for `css()` or `style`. Keys are the variables'
 * own names, so a misspelled or removed variable is a type error instead of a silent no-op.
 *
 * @example <NovelPlayer mix={css(theme({ "--novel-accent": "#9c7630", "--novel-dialog-color": "#f3e7cc" }))} />
 * @example <NovelPlayer style={theme({ "--novel-text-size": "4cqh" })} />
 */
export function theme(values: NovelTheme): NovelTheme {
	let styles: NovelTheme = {};
	for (let [name, value] of Object.entries(values) as [NovelThemeVariable, string | number][]) {
		if (value !== undefined) styles[name] = value;
	}
	return styles;
}

/**
 * Reads a theme variable with its default, for a part's styles.
 *
 * @example themeVar("--novel-accent"); // "var(--novel-accent, #f4c95d)"
 */
export function themeVar(name: NovelThemeVariable): string {
	return `var(${name}, ${NOVEL_THEME_VARIABLES[name]})`;
}

/**
 * The inline surface of a player dialog: its background, color, frame, shadow and type, read
 * from the theme so a game restyles every screen at once. `border` comes before the image frame,
 * since the shorthand resets it.
 */
export function dialogSurface(): Record<string, string> {
	return {
		background: themeVar("--novel-dialog-background"),
		color: themeVar("--novel-dialog-color"),
		border: themeVar("--novel-dialog-border"),
		borderImageSource: themeVar("--novel-dialog-border-image-source"),
		borderImageSlice: themeVar("--novel-dialog-border-image-slice"),
		borderImageWidth: themeVar("--novel-dialog-border-image-width"),
		boxShadow: themeVar("--novel-dialog-shadow"),
		fontFamily: themeVar("--novel-dialog-font"),
		fontSize: themeVar("--novel-dialog-font-size"),
	};
}

/** The inline type of a player dialog's title, which every screen shares. */
export function dialogTitle(): Record<string, string> {
	return {
		fontFamily: themeVar("--novel-dialog-title-font"),
		fontWeight: themeVar("--novel-dialog-title-weight"),
		letterSpacing: themeVar("--novel-dialog-title-tracking"),
		color: themeVar("--novel-dialog-title-color"),
	};
}

/**
 * The player's surfaces, by their `data-novel-theme-surface` value: a dialog, and the settings and
 * encyclopedia pages set inside one. Each names the ink, accent, text on the accent, line and
 * field color its controls take; an unset page color follows the dialog's.
 */
const SURFACES = {
	dialog: {
		ink: themeVar("--novel-dialog-color"),
		accent: themeVar("--novel-dialog-accent"),
		"on-accent": themeVar("--novel-dialog-on-accent"),
		line: themeVar("--novel-dialog-line"),
		field: themeVar("--novel-dialog-field"),
	},
	settings: {
		ink: `var(--novel-settings-panel-color, ${themeVar("--novel-dialog-color")})`,
		accent: themeVar("--novel-settings-panel-accent"),
		"on-accent": themeVar("--novel-settings-panel-on-accent"),
		line: themeVar("--novel-settings-panel-line"),
		field: themeVar("--novel-settings-panel-field"),
	},
	encyclopedia: {
		ink: `var(--novel-encyclopedia-page-color, var(--novel-settings-panel-color, ${themeVar("--novel-dialog-color")}))`,
		accent: themeVar("--novel-settings-panel-accent"),
		"on-accent": themeVar("--novel-settings-panel-on-accent"),
		line: themeVar("--novel-settings-panel-line"),
		field: themeVar("--novel-settings-panel-field"),
	},
} as const;

/**
 * The `@sdxc/ui` tokens every element inside a surface takes, mixed from that surface's colors:
 * neutral text, fields, lines and their hover tints from the ink, line and field, and the brand
 * fill, its text and every focus ring from the accent.
 */
const BRIDGED_TOKENS = {
	"--ui-fg": "var(--novel-ui-ink)",
	"--ui-border": "var(--novel-ui-line)",
	"--ui-ring": "var(--novel-ui-accent)",
	"--ui-neutral-fg-emphasis": "var(--novel-ui-ink)",
	"--ui-neutral-fg": "color-mix(in oklab, var(--novel-ui-ink) 80%, transparent)",
	"--ui-neutral-fg-muted": "color-mix(in oklab, var(--novel-ui-ink) 65%, transparent)",
	"--ui-neutral-bg-tint": "var(--novel-ui-field)",
	"--ui-neutral-bg-tint-hover": "color-mix(in oklab, var(--novel-ui-ink) 14%, transparent)",
	"--ui-neutral-bg-tint-pressed": "color-mix(in oklab, var(--novel-ui-ink) 22%, transparent)",
	"--ui-neutral-border": "var(--novel-ui-line)",
	"--ui-neutral-border-hover": "color-mix(in oklab, var(--novel-ui-line), var(--novel-ui-ink) 30%)",
	"--ui-neutral-border-strong": "color-mix(in oklab, var(--novel-ui-ink) 60%, transparent)",
	"--ui-neutral-ring": "var(--novel-ui-accent)",
	"--ui-brand-fg": "var(--novel-ui-accent)",
	"--ui-brand-fg-on-solid": "var(--novel-ui-on-accent)",
	"--ui-brand-bg-solid": "var(--novel-ui-accent)",
	"--ui-brand-bg-solid-hover":
		"color-mix(in oklab, var(--novel-ui-accent) 85%, var(--novel-ui-ink))",
	"--ui-brand-bg-solid-pressed":
		"color-mix(in oklab, var(--novel-ui-accent) 75%, var(--novel-ui-ink))",
	"--ui-brand-bg-tint": "color-mix(in oklab, var(--novel-ui-accent) 16%, transparent)",
	"--ui-brand-bg-tint-hover": "color-mix(in oklab, var(--novel-ui-accent) 24%, transparent)",
	"--ui-brand-bg-tint-pressed": "color-mix(in oklab, var(--novel-ui-accent) 32%, transparent)",
	"--ui-brand-border": "color-mix(in oklab, var(--novel-ui-accent) 50%, transparent)",
	"--ui-brand-border-hover": "var(--novel-ui-accent)",
	"--ui-brand-border-strong": "var(--novel-ui-accent)",
	"--ui-brand-ring": "var(--novel-ui-accent)",
} as const;

/** Writes `declarations` as the body of one CSS rule. */
function declarationBlock(declarations: Record<string, string>): string {
	return Object.entries(declarations)
		.map(([name, value]) => `${name}: ${value};`)
		.join(" ");
}

/**
 * The stylesheet bridging the theme into `@sdxc/ui`: each surface resolves its colors into
 * `--novel-ui-*` once, and every element inside maps the UI tokens onto them, unlayered and with
 * two attribute selectors, so it outranks a theme that sets the tokens on every element.
 */
export const THEME_BRIDGE_STYLESHEET = [
	...Object.entries(SURFACES).map(
		([surface, colors]) =>
			`[data-novel-theme-surface="${surface}"] { ${declarationBlock(
				Object.fromEntries(
					Object.entries(colors).map(([name, value]) => [`--novel-ui-${name}`, value]),
				),
			)} }`,
	),
	`[data-novel-theme-surface] *:not([data-novel-theme-surface]) { ${declarationBlock(BRIDGED_TOKENS)} }`,
].join("\n");
