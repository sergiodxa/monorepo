/**
 * The stylesheet that carries the player's theme into `@sdxc/ui` controls, as an element a part
 * renders. A player renders it once on its root, and a dialog rendered outside a player renders
 * its own, so its close button, sliders and switches follow the theme in either place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { NovelPlayer } from "./player.js";
import { THEME_BRIDGE_STYLESHEET } from "./theme.js";

/** Props {@link ThemeBridge} accepts. */
export interface ThemeBridgeProps {
	/** Renders the stylesheet inside a player too; the player's root sets it. */
	root?: boolean;
}

/**
 * The theme bridge's `<style>` element, rendered by a player's root and by a surface outside a
 * player, so a page holds one copy per player.
 */
export function ThemeBridge(handle: Handle<ThemeBridgeProps>) {
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		if (player !== undefined && handle.props.root !== true) return null;
		return <style data-novel-theme-bridge="">{THEME_BRIDGE_STYLESHEET}</style>;
	};
}
