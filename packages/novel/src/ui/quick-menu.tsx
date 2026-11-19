/**
 * The quick menu along the bottom of the stage: auto and skip toggles, quick save and load, and
 * buttons that open the backlog, save, load and settings dialogs through Invoker Commands, so
 * the screens open without script and the player only hears about the toggles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { css, on } from "remix/component";

import type { NovelLabels, PlayerAction } from "./settings.js";

export namespace QuickMenu {
	/** Props {@link QuickMenu} accepts. */
	export interface Props extends Omit<TagProps<"nav">, "children"> {
		auto: boolean;
		skip: boolean;
		/** The ids of the dialogs the menu opens. */
		dialogs: { backlog: string; save: string; load: string; settings: string };
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
		let { auto, skip, dialogs, onAction, labels, mix, ...rest } = handle.props;
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
			["save", labels.save, dialogs.save],
			["load", labels.load, dialogs.load],
			["settings", labels.settings, dialogs.settings],
		] as const;
		let plain = [
			["quickSave", labels.quickSave],
			["quickLoad", labels.quickLoad],
			["hide", labels.hide],
			["fullscreen", labels.fullscreen],
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
