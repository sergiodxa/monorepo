/**
 * The quick menu along the bottom of the stage: auto and skip toggles, quick save and load,
 * buttons that open the backlog, save, load and settings dialogs through Invoker Commands, so
 * screens open without script, and whatever the game adds as children, such as the extras.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, Handle, Props as TagProps, RemixNode } from "remix/component";

import { css, on } from "remix/component";

import { perform } from "./controls.js";
import { NovelPlayer } from "./player.js";
import { themeVar } from "./theme.js";

export namespace QuickMenu {
	/** Props {@link QuickMenu} accepts. */
	export interface Props extends Omit<TagProps<"nav">, "children"> {
		/** Drawn after the built-in buttons, such as `NovelPlayer.Extras`. */
		children?: RemixNode;
	}
}

/**
 * Styles a button of the quick menu from the theme; `aria-pressed` marks a mode that is on.
 *
 * @example <button type="button" mix={quickMenuButton()}>Extras</button>
 */
export function quickMenuButton(): CSSMixinDescriptor {
	return css({
		padding: "0.4cqh 0.8cqw",
		border: 0,
		borderRadius: "0.6cqh",
		background: "transparent",
		color: themeVar("--novel-menu-color"),
		font: "inherit",
		cursor: "pointer",
		'&:hover, &:focus-visible, &[aria-pressed="true"]': {
			color: themeVar("--novel-menu-active-color"),
			outline: "none",
		},
	});
}

/**
 * Draws the quick menu while the interface shows. A replay swaps saving for an "End replay"
 * button, and a player with a title screen offers a way back to it. The buttons open the
 * player's dialogs, so a dialog left out of the layout opens nothing.
 *
 * @example <NovelPlayer.QuickMenu><NovelPlayer.Extras>…</NovelPlayer.Extras></NovelPlayer.QuickMenu>
 */
export function QuickMenu(handle: Handle<QuickMenu.Props>) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let { children, mix, ...rest } = handle.props;
		if (player.hidden || player.ending !== undefined) return null;
		let { labels, ids, replaying } = player;
		let actions = [
			["auto", labels.auto, player.auto.enabled],
			["skip", labels.skip, player.skip.active],
		] as const;
		let commands = [
			["backlog", labels.backlog, ids.backlog],
			...(replaying ? [] : ([["save", labels.save, ids.save]] as const)),
			["load", labels.load, ids.load],
			["settings", labels.settings, ids.settings],
		] as const;
		let plain = [
			...(replaying
				? ([["endReplay", labels.endReplay]] as const)
				: ([["quickSave", labels.quickSave]] as const)),
			["quickLoad", labels.quickLoad],
			["hide", labels.hide],
			["fullscreen", labels.fullscreen],
			...(player.returnsToTitle && !replaying ? ([["toTitle", labels.toTitle]] as const) : []),
		] as const;
		return (
			<nav
				{...rest}
				aria-label={labels.menu}
				data-novel-ui=""
				data-novel-menu=""
				mix={[
					css({
						position: "absolute",
						inset: themeVar("--novel-menu-inset"),
						display: "flex",
						flexWrap: "wrap",
						gap: "0.4cqw",
						padding: themeVar("--novel-menu-padding"),
						borderRadius: themeVar("--novel-menu-radius"),
						background: themeVar("--novel-menu-background"),
						fontSize: themeVar("--novel-menu-font-size"),
						zIndex: 5,
					}),
					mix,
				]}
			>
				{actions.map(([action, label, pressed]) => (
					<button
						key={action}
						type="button"
						data-action={action}
						aria-pressed={pressed}
						mix={[quickMenuButton(), on("click", () => perform(player, action))]}
					>
						{label}
					</button>
				))}
				{commands.map(([action, label, target]) => (
					<button
						key={action}
						type="button"
						data-action={action}
						commandfor={target}
						command="show-modal"
						mix={quickMenuButton()}
					>
						{label}
					</button>
				))}
				{plain.map(([action, label]) => (
					<button
						key={action}
						type="button"
						data-action={action}
						mix={[quickMenuButton(), on("click", () => perform(player, action))]}
					>
						{label}
					</button>
				))}
				{children}
			</nav>
		);
	};
}
