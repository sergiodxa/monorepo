/**
 * The choice menu: the prompt and one button per option, a locked option shown disabled with
 * its reason, an option taken before marked `data-chosen`, and a timed menu counting down
 * before it takes the menu's default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { css, on } from "remix/component";

import type { ChoiceFrame } from "../frames.js";

import { Message } from "./message.js";

export namespace ChoiceMenu {
	/** Props {@link ChoiceMenu} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		frame: ChoiceFrame;
		/** Called with the option's id when the reader picks one, or when a timed menu runs out. */
		onChoose: (option: string) => void;
		/** The countdown's accessible name. */
		timeLeftLabel?: string;
	}
}

/**
 * The option a timed menu takes when it runs out: its `default`, else its first available option.
 *
 * @param frame - The menu.
 * @returns The option's id, or `undefined` when nothing is available.
 */
export function timeoutOption(frame: ChoiceFrame): string | undefined {
	return frame.default ?? frame.options.find((option) => !option.disabled)?.id;
}

/**
 * Draws a menu and reports the option taken. A timed menu starts its countdown when it mounts,
 * and a new frame restarts it.
 *
 * @example <ChoiceMenu frame={frame} onChoose={(id) => reply(frame.choose(id))} />
 */
export function ChoiceMenu(handle: Handle<ChoiceMenu.Props>) {
	let timedFrame: string | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	handle.signal.addEventListener("abort", () => clearTimeout(timer));

	/** Starts the countdown for a timed frame it has not started one for. */
	function countdown(): void {
		let { frame } = handle.props;
		if (frame.timeout === undefined || timedFrame === frame.id) return;
		clearTimeout(timer);
		timedFrame = frame.id;
		timer = setTimeout(() => {
			let option = timeoutOption(handle.props.frame);
			if (option !== undefined && handle.props.frame.id === frame.id) handle.props.onChoose(option);
		}, frame.timeout);
	}

	return () => {
		let { frame, onChoose, timeLeftLabel, mix, ...rest } = handle.props;
		handle.queueTask(countdown);
		return (
			<div
				{...rest}
				data-novel-choices=""
				role="group"
				aria-labelledby={frame.prompt === undefined ? undefined : `${handle.id}-prompt`}
				mix={[
					css({
						position: "absolute",
						inset: 0,
						display: "grid",
						alignContent: "center",
						justifyItems: "center",
						gap: "2cqh",
						paddingBlockEnd: "12cqh",
						zIndex: 4,
						fontSize: "calc(3.2cqh * var(--novel-font-scale, 1))",
						fontFamily: "var(--novel-text-font, inherit)",
					}),
					mix,
				]}
			>
				{frame.prompt === undefined ? null : (
					<p
						id={`${handle.id}-prompt`}
						mix={css({
							margin: 0,
							paddingBlock: "1cqh",
							paddingInline: "2cqw",
							borderRadius: "1cqh",
							background: "rgb(0 0 0 / 0.6)",
							color: "#fff",
						})}
					>
						<Message i18nKey={frame.prompt} />
					</p>
				)}
				{frame.timeout === undefined ? null : (
					<div
						key={`${frame.id}-timer`}
						data-novel-timer=""
						role="timer"
						aria-label={timeLeftLabel}
						mix={css({
							inlineSize: "46cqw",
							blockSize: "0.8cqh",
							borderRadius: "0.4cqh",
							background: "rgb(255 255 255 / 0.25)",
							overflow: "hidden",
							"&::after": {
								content: '""',
								display: "block",
								blockSize: "100%",
								background: "var(--novel-accent, #f4c95d)",
								transformOrigin: "0 50%",
								animation: "novel-countdown var(--novel-timeout) linear forwards",
							},
							"@keyframes novel-countdown": {
								from: { transform: "scaleX(1)" },
								to: { transform: "scaleX(0)" },
							},
						})}
						style={{ "--novel-timeout": `${frame.timeout}ms` }}
					/>
				)}
				{frame.options.map((option) => (
					<div
						key={option.id}
						mix={css({ display: "grid", justifyItems: "center", gap: "0.6cqh" })}
					>
						<button
							type="button"
							data-option={option.id}
							data-chosen={String(option.chosen)}
							disabled={option.disabled}
							aria-describedby={
								option.reason === undefined ? undefined : `${handle.id}-${option.id}-reason`
							}
							mix={[
								css({
									minInlineSize: "46cqw",
									paddingBlock: "1.4cqh",
									paddingInline: "3cqw",
									border: "0.2cqh solid rgb(255 255 255 / 0.35)",
									borderRadius: "1.2cqh",
									background: "var(--novel-option-background, rgb(20 20 40 / 0.85))",
									color: "#fff",
									font: "inherit",
									cursor: "pointer",
									transition: "background 150ms ease, border-color 150ms ease",
									"&:hover:not(:disabled), &:focus-visible": {
										background: "var(--novel-option-hover, rgb(60 60 110 / 0.95))",
										borderColor: "var(--novel-accent, #f4c95d)",
										outline: "none",
									},
									'&[data-chosen="true"]': { color: "var(--novel-chosen-color, #b8b8d0)" },
									"&:disabled": { opacity: 0.5, cursor: "not-allowed" },
								}),
								on("click", () => onChoose(option.id)),
							]}
						>
							<Message i18nKey={option.label} />
						</button>
						{option.reason === undefined ? null : (
							<small
								id={`${handle.id}-${option.id}-reason`}
								mix={css({ color: "#fff", textShadow: "0 0 0.4cqh #000" })}
							>
								<Message i18nKey={option.reason} />
							</small>
						)}
					</div>
				))}
			</div>
		);
	};
}
