/**
 * The presentation color palette.
 *
 * Every hard-coded color the renderer uses lives here so the whole look can be
 * retuned in one place and no drawing code carries a raw hex or hsl literal. The
 * constants are grouped by where they are drawn (battle scene, HP bar, windows,
 * text, tiles, the player sprite, and each full-screen scene background) and each
 * one documents its exact call site. Genuinely dynamic colors — the per-species
 * placeholder hue — stay computed by a helper here, with their fixed saturation,
 * lightness, and outline exposed as constants rather than forced into a single
 * value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Colors for the battle backdrop drawn in `battle/battle-scene.ts`. */
export const BattleBackdrop = {
	/** The upper sky band of the battle backdrop (`drawBackground`). */
	sky: "#98d0e0",
	/** The lower ground strip of the battle backdrop (`drawBackground`). */
	ground: "#d8c890",
} as const;

/** Colors for the animated HP bar drawn in `battle/hp-bar.ts`. */
export const HpBarColor = {
	/** The 1px outline framing the bar (`draw`). */
	outline: "#202020",
	/** The empty track behind the fill (`draw`). */
	track: "#585858",
	/** The fill when HP ratio is above 50% (`draw`). */
	fillHigh: "#48c048",
	/** The fill when HP ratio is between 20% and 50% (`draw`). */
	fillMedium: "#e8c020",
	/** The fill when HP ratio is at or below 20% (`draw`). */
	fillLow: "#e04030",
	/** The HP fraction text drawn under the bar (`draw`). */
	numbers: "#f8f8f8",
} as const;

/** Colors for the shared menu/message window in `render/window.ts`. */
export const WindowColor = {
	/** The procedural panel fill when no windowskin is supplied (`frame`). */
	panel: "#f8f8f8",
	/** The procedural panel border (`frame`). */
	border: "#3060a8",
	/** The triangular selection cursor glyph (`cursor`). */
	cursor: "#202020",
} as const;

/** Text colors used by `render/text.ts` and its callers. */
export const Text = {
	/** The default `drawText` color when no `color` option is given (`render/text.ts`). */
	default: "#202020",
	/** Secondary body copy: species/HP/status lines, party count (`scenes/summary.ts`, `scenes/storage.ts`). */
	secondary: "#404040",
	/** Muted labels: PP counts, hints, scroll arrows, empty-state notes (`render/list-menu.ts`, `battle/command-menu.ts`, and several scenes). */
	muted: "#606060",
	/** Disabled entries: out-of-PP moves and the unavailable Continue option (`battle/command-menu.ts`, `scenes/title.ts`). */
	disabled: "#a0a0a0",
	/** Inverse text on dark backgrounds: boot/title/save/evolution/HP-number copy (`scenes/boot.ts`, `scenes/title.ts`, `battle/hp-bar.ts`). */
	inverse: "#f8f8f8",
	/** Pure-white inverse text: sprite initials, overworld hint, menu label (`battle/battle-scene.ts`, `overworld/overworld-scene.ts`, `scenes/menu.ts`). */
	inverseWhite: "#ffffff",
	/** The muted "Loading..." label on the boot screen (`scenes/boot.ts`). */
	bootLoading: "#a0a8b0",
} as const;

/** Placeholder tile colors for the procedural `TileMapRenderer` in `render/tilemap.ts`. */
export const Tile = {
	/** A walkable/grass cell with no special collision (`tileColor` default). */
	walkable: "#8ccf6f",
	/** A walkable cell inside an encounter zone, tinted as tall grass (`tileColor`). */
	grass: "#4a9e4a",
	/** A solid, impassable cell (`tileColor`, `Collision.Solid`). */
	solid: "#7d7d7d",
	/** A water cell (`tileColor`, `Collision.Water`). */
	water: "#3b74c4",
	/** A ledge cell (`tileColor`, `Collision.LedgeDown`). */
	ledge: "#c9b382",
	/** The faint per-cell grid line stroked over placeholder tiles (`drawProcedural`). */
	gridLine: "rgba(0, 0, 0, 0.08)",
} as const;

/** Colors for the procedural player sprite drawn in `overworld/overworld-scene.ts`. */
export const Player = {
	/** The player's body/torso rectangle (`drawPlayer`). */
	body: "#d03030",
	/** The player's head/skin rectangle (`drawPlayer`). */
	skin: "#f0c090",
	/** The small nub marking which direction the player faces (`drawPlayer`). */
	facingNub: "#202020",
} as const;

/** Full-screen background fills, one per scene. */
export const SceneBackground = {
	/** The boot loading screen fill (`scenes/boot.ts`). */
	boot: "#101820",
	/** The title screen fill (`scenes/title.ts`). */
	title: "#2848a0",
	/** The party screen fill (`scenes/party.ts`). */
	party: "#c8d8e8",
	/** The bag screen fill (`scenes/bag.ts`). */
	bag: "#e8ddc0",
	/** The bestiary screen fill (`scenes/bestiary.ts`). */
	bestiary: "#d8c8e0",
	/** The storage screen fill (`scenes/storage.ts`). */
	storage: "#cfe0d8",
	/** The summary screen fill (`scenes/summary.ts`). */
	summary: "#e0e0d0",
	/** The save screen fill (`scenes/save.ts`). */
	save: "#203040",
	/** The evolution screen fill (`scenes/evolution.ts`). */
	evolution: "#101828",
} as const;

/** The boot progress bar's two-tone fill (`scenes/boot.ts`). */
export const BootProgress = {
	/** The empty track behind the progress fill. */
	track: "#404850",
	/** The filled portion of the progress bar. */
	fill: "#f8f8f8",
} as const;

/**
 * The fixed parts of the per-species placeholder creature color in
 * `battle/battle-scene.ts`. Only the hue is derived from the species id; the
 * saturation and lightness are constant, so the whole family shares one look.
 */
export const CreaturePlaceholder = {
	/** Constant saturation (%) for the placeholder sprite fill (`colorFor`). */
	saturation: 55,
	/** Constant lightness (%) for the placeholder sprite fill (`colorFor`). */
	lightness: 60,
	/** The 1px outline around the placeholder sprite (`drawCreature`). */
	outline: "#202020",
} as const;

/**
 * Builds the placeholder creature fill for a given hue.
 *
 * The hue is derived per-species by the caller (a stable hash of the species
 * id); saturation and lightness are the fixed `CreaturePlaceholder` values so
 * only the hue varies between species.
 */
export function creatureColor(hue: number): string {
	return `hsl(${hue}, ${CreaturePlaceholder.saturation}%, ${CreaturePlaceholder.lightness}%)`;
}
