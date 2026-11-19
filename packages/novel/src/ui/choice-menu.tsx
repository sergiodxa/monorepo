/**
 * The choice menu: the prompt and one button per option, a locked option shown disabled with
 * its reason, an option taken before marked `data-chosen`, and a timed menu counting down
 * through the player's countdown before it takes the menu's default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { css, on } from "remix/component";

import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { themeVar } from "./theme.js";

export namespace ChoiceMenu {
	/** Props {@link ChoiceMenu} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {}
}

/**
 * The current menu: its prompt and one button per option, answering the player with the option
 * picked. It shows once the stage settles, and a timed menu runs the player's `countdown`.
 *
 * @example <NovelPlayer.Choices mix={css({ "--novel-option-background": "url(/option.png)" })} />
 */
export function ChoiceMenu(handle: Handle<ChoiceMenu.Props>) {
	let player = handle.context.get(NovelPlayer);

	return () => {
		let { mix, ...rest } = handle.props;
		let frame = player.frame;
		if (player.hidden || player.ending !== undefined || frame?.type !== "choice") return null;
		if (player.phase === "staging") return null;
		handle.queueTask(() => {
			if (player.frame === frame) player.countdown.start(frame);
		});
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
						gap: themeVar("--novel-choices-gap"),
						paddingBlockEnd: "12cqh",
						zIndex: 4,
						fontSize: "calc(3.2cqh * var(--novel-font-scale, 1))",
						fontFamily: themeVar("--novel-text-font"),
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
							background: themeVar("--novel-prompt-background"),
							color: themeVar("--novel-prompt-color"),
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
						aria-label={player.labels.timeLeft}
						mix={css({
							inlineSize: themeVar("--novel-option-min-inline-size"),
							blockSize: themeVar("--novel-countdown-height"),
							borderRadius: "0.4cqh",
							background: themeVar("--novel-countdown-track"),
							overflow: "hidden",
							"&::after": {
								content: '""',
								display: "block",
								blockSize: "100%",
								background: themeVar("--novel-countdown-fill"),
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
									minInlineSize: themeVar("--novel-option-min-inline-size"),
									padding: themeVar("--novel-option-padding"),
									border: themeVar("--novel-option-border"),
									borderImageSource: themeVar("--novel-option-border-image-source"),
									borderImageSlice: themeVar("--novel-option-border-image-slice"),
									borderImageWidth: themeVar("--novel-option-border-image-width"),
									borderRadius: themeVar("--novel-option-radius"),
									background: themeVar("--novel-option-background"),
									color: themeVar("--novel-option-color"),
									font: "inherit",
									cursor: "pointer",
									transition: "background 150ms ease, border-color 150ms ease",
									"&:hover:not(:disabled), &:focus-visible": {
										background: themeVar("--novel-option-hover"),
										color: themeVar("--novel-option-hover-color"),
										borderColor: themeVar("--novel-option-hover-border-color"),
										outline: themeVar("--novel-option-focus-outline"),
									},
									'&[data-chosen="true"]': { color: themeVar("--novel-chosen-color") },
									"&:disabled": {
										opacity: themeVar("--novel-option-disabled-opacity"),
										cursor: "not-allowed",
									},
								}),
								on("click", () => player.answer(frame.choose(option.id))),
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
