/**
 * The textbox: the speaker's name in their color and the line typed out at the reader's text
 * speed. It is a live region holding the whole line from the start, so a screen reader reads
 * it at once while the typewriter only changes what is painted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Trans } from "@sdxc/i18n/ui";
import type { Handle, Props as TagProps, RemixElement } from "remix/component";

import { css, ref } from "remix/component";

import type { LineFrame } from "../frames.js";
import type { AudioSound } from "../stage.js";

import { Message } from "./message.js";
import { Typewriter, UNREVEALED_HIGHLIGHT } from "./typewriter.js";

export namespace Textbox {
	/** Props {@link Textbox} accepts. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		frame: LineFrame;
		/** Starts the typewriter; the player sets it once the stage has settled. */
		typing: boolean;
		/** Characters per second; `0` shows the line at once. */
		textSpeed: number;
		/** Shows the rest of the line at once, which a click during typing does. */
		complete?: boolean;
		/** Called once the whole line is visible. */
		onRevealed?: () => void;
		/** Markup elements beside the built-in line effects. */
		markup?: Record<string, RemixElement | Trans.MarkupComponent>;
	}

	/** Props {@link Captions} accepts. */
	export interface CaptionsProps extends Omit<TagProps<"ul">, "children"> {
		/** The sounds a frame started; those with a caption are shown. */
		sounds: AudioSound[];
	}
}

/**
 * Draws a line frame's speaker and text, revealing the text character by character.
 *
 * @example <Textbox frame={frame} typing={settled} textSpeed={settings.textSpeed} onRevealed={next} />
 */
export function Textbox(handle: Handle<Textbox.Props>) {
	let line: HTMLElement | undefined;
	let writer: Typewriter | undefined;
	let writerFrame: string | undefined;
	let started = false;

	handle.signal.addEventListener("abort", () => writer?.dispose());

	/** Keeps the typewriter in step with the props after each commit. */
	function sync(): void {
		let { frame, typing, textSpeed, complete } = handle.props;
		if (line === undefined) return;
		if (writerFrame !== frame.id || writer === undefined) {
			writer?.dispose();
			let created = new Typewriter(line);
			writer = created;
			writerFrame = frame.id;
			started = false;
			void created.done.then(() => {
				if (writer === created) handle.props.onRevealed?.();
			});
		}
		if (typing && !started) {
			started = true;
			writer.start(textSpeed);
		}
		if (complete === true && started) writer.finish();
	}

	return () => {
		let {
			frame,
			typing: _typing,
			textSpeed: _textSpeed,
			complete: _complete,
			onRevealed: _onRevealed,
			markup,
			mix,
			...rest
		} = handle.props;
		handle.queueTask(sync);
		return (
			<section
				{...rest}
				data-novel-textbox=""
				aria-live="polite"
				mix={[
					css({
						position: "absolute",
						insetInline: "4cqw",
						insetBlockEnd: "3cqh",
						minBlockSize: "24cqh",
						paddingBlock: "2.4cqh",
						paddingInline: "3cqw",
						borderRadius: "1.4cqh",
						background: "var(--novel-textbox-background, rgb(10 10 20 / 0.78))",
						color: "var(--novel-textbox-color, #fff)",
						fontFamily: "var(--novel-text-font, inherit)",
						letterSpacing: "var(--novel-text-tracking, normal)",
						wordSpacing: "var(--novel-text-word-spacing, normal)",
						fontSize: "calc(3.4cqh * var(--novel-font-scale, 1))",
						lineHeight: "var(--novel-text-leading, 1.45)",
						zIndex: 3,
						[`& ::highlight(${UNREVEALED_HIGHLIGHT}), &::highlight(${UNREVEALED_HIGHLIGHT})`]: {
							color: "transparent",
							textShadow: "none",
						},
					}),
					mix,
				]}
			>
				{frame.speakers.length === 0 ? null : (
					<p
						data-novel-speaker=""
						mix={css({ margin: 0, marginBlockEnd: "0.6cqh", fontWeight: 700 })}
					>
						{frame.speakers.map((speaker, index) => (
							<span key={speaker.id} style={{ color: speaker.color }}>
								{index > 0 ? " & " : null}
								<Message i18nKey={speaker.name} />
							</span>
						))}
					</p>
				)}
				<p
					data-novel-line=""
					data-frame={frame.id}
					mix={[
						ref((node) => {
							line = node;
							sync();
						}),
						css({ margin: 0, textWrap: "pretty" }),
					]}
				>
					<Message key={frame.id} i18nKey={frame.key} values={frame.values} markup={markup} />
				</p>
			</section>
		);
	};
}

/**
 * Shows the captions of the sounds a frame started, for readers who play without sound.
 *
 * @example <Captions sounds={frame.audio.sounds} />
 */
export function Captions(handle: Handle<Textbox.CaptionsProps>) {
	return () => {
		let { sounds, mix, ...rest } = handle.props;
		let captioned = sounds.filter((sound) => sound.caption !== undefined);
		return (
			<ul
				{...rest}
				data-novel-captions=""
				role="status"
				mix={[
					css({
						position: "absolute",
						insetBlockStart: "3cqh",
						insetInlineStart: "3cqw",
						margin: 0,
						padding: 0,
						listStyle: "none",
						display: "grid",
						gap: "1cqh",
						fontSize: "calc(2.6cqh * var(--novel-font-scale, 1))",
						zIndex: 3,
						"& li": {
							paddingBlock: "0.6cqh",
							paddingInline: "1.4cqw",
							borderRadius: "0.8cqh",
							background: "rgb(0 0 0 / 0.65)",
							color: "#fff",
							fontStyle: "italic",
						},
					}),
					mix,
				]}
			>
				{captioned.map((sound) => (
					<li key={sound.occurrence}>
						<Message i18nKey={sound.caption ?? ""} />
					</li>
				))}
			</ul>
		);
	};
}
