/**
 * The quick menu along the bottom of the stage: auto and skip toggles, quick save and load,
 * buttons that open the backlog, save, load and settings dialogs, and an extras menu (a popover)
 * opening the library screens, all through Invoker Commands, so screens open without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { Menu } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { NovelLabels, PlayerAction } from "./settings.js";

export namespace QuickMenu {
	/** Props {@link QuickMenu} accepts. */
	export interface Props extends Omit<TagProps<"nav">, "children"> {
		auto: boolean;
		skip: boolean;
		/** The ids of the dialogs the menu opens. */
		dialogs: { backlog: string; save: string; load: string; settings: string };
		/** The ids of the library screens' dialogs, listed in an extras menu; without it there is none. */
		extras?: {
			memories: string;
			gallery: string;
			music: string;
			endings: string;
			chapters: string;
			scenes: string;
		};
		/** Shows the menu of a replay: no saving, and a button that ends the replay. */
		replay?: boolean;
		/** Called for the actions that are not a dialog: auto, skip, quick save and load, hide, full screen. */
		onAction: (action: PlayerAction) => void;
		labels: NovelLabels;
	}
}

/**
 * Draws the quick menu. Each button stops its click from reaching the stage, so using the menu
 * never advances the story.
 *
 * @example <QuickMenu auto={auto} skip={skip} dialogs={ids} onAction={run} labels={DEFAULT_LABELS} />
 */
export function QuickMenu(handle: Handle<QuickMenu.Props>) {
	return () => {
		let {
			auto,
			skip,
			dialogs,
			extras,
			replay = false,
			onAction,
			labels,
			mix,
			...rest
		} = handle.props;
		let menuId = `${handle.id}-extras`.replace(/[^\w-]/g, "-");
		let button = css({
			padding: "0.4cqh 0.8cqw",
			border: 0,
			borderRadius: "0.6cqh",
			background: "transparent",
			color: "var(--novel-menu-color, rgb(255 255 255 / 0.75))",
			font: "inherit",
			cursor: "pointer",
			'&:hover, &:focus-visible, &[aria-pressed="true"]': {
				color: "var(--novel-accent, #f4c95d)",
				outline: "none",
			},
		});
		let actions = [
			["auto", labels.auto, auto],
			["skip", labels.skip, skip],
		] as const;
		let commands = [
			["backlog", labels.backlog, dialogs.backlog],
			...(replay ? [] : ([["save", labels.save, dialogs.save]] as const)),
			["load", labels.load, dialogs.load],
			["settings", labels.settings, dialogs.settings],
		] as const;
		let plain = [
			...(replay
				? ([["endReplay", labels.endReplay]] as const)
				: ([["quickSave", labels.quickSave]] as const)),
			["quickLoad", labels.quickLoad],
			["hide", labels.hide],
			["fullscreen", labels.fullscreen],
		] as const;
		let screens =
			extras === undefined
				? []
				: ([
						["memories", labels.memories, extras.memories],
						["gallery", labels.gallery, extras.gallery],
						["music", labels.musicRoom, extras.music],
						["endings", labels.endings, extras.endings],
						["chapters", labels.chapterSelect, extras.chapters],
						["scenes", labels.sceneReplay, extras.scenes],
					] as const);
		return (
			<nav
				{...rest}
				aria-label={labels.menu}
				data-novel-ui=""
				data-novel-menu=""
				mix={[
					css({
						position: "absolute",
						insetInlineEnd: "5cqw",
						insetBlockEnd: "3.6cqh",
						display: "flex",
						flexWrap: "wrap",
						gap: "0.4cqw",
						fontSize: "2.2cqh",
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
						mix={[button, on("click", () => onAction(action))]}
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
						mix={button}
					>
						{label}
					</button>
				))}
				{screens.length === 0 ? null : (
					<button
						type="button"
						data-action="extras"
						commandfor={menuId}
						command="toggle-popover"
						mix={button}
					>
						{labels.extras}
					</button>
				)}
				{screens.length === 0 ? null : (
					<Menu id={menuId} placement="top-end" aria-label={labels.extras} data-novel-extras="">
						{screens.map(([screen, label, target]) => (
							<Menu.Item key={screen} data-screen={screen} commandfor={target} command="show-modal">
								{label}
							</Menu.Item>
						))}
					</Menu>
				)}
				{plain.map(([action, label]) => (
					<button
						key={action}
						type="button"
						data-action={action}
						mix={[button, on("click", () => onAction(action))]}
					>
						{label}
					</button>
				))}
			</nav>
		);
	};
}
