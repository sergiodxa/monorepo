/**
 * The textbox and its pieces: the name plate in the speaker's color, the line revealed at the
 * reader's text speed, the next-line indicator, and the captions of the frame's sounds. Each
 * reads the play from `NovelPlayer`'s context, and the line stays whole in a live region.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { typewriterText } from "@sdxc/ui/styles";
import { Typewriter } from "@sdxc/ui/utils";
import { css, on, ref } from "remix/component";

import type { Speaker } from "../frames.js";
import type { AudioSound } from "../stage.js";

import { Message } from "./message.js";
import { NovelPlayer } from "./player.js";
import { listenerSignal } from "./signal.js";
import { themeVar } from "./theme.js";

export namespace Textbox {
	/** Props {@link Textbox} accepts. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		/**
		 * What the box holds; without children it holds the name plate, the line and the
		 * next-line indicator.
		 */
		children?: RemixNode;
	}

	/** Props {@link NamePlate}, {@link Line} and {@link NextIndicator} accept. */
	export interface PartProps extends Omit<TagProps<"p">, "children"> {}

	/** Props {@link Captions} accepts. */
	export interface CaptionsProps extends Omit<TagProps<"ul">, "children"> {
		/** The sounds to caption; inside a player it defaults to those the frame started. */
		sounds?: AudioSound[];
	}
}

/**
 * The box a line frame shows in. It renders while the play shows a line and the interface is
 * neither hidden nor past an ending, and is a polite live region, so a screen reader reads the
 * whole line at once. It carries `data-novel-read` while the line was read before.
 *
 * @example <NovelPlayer.Textbox mix={css({ "--novel-textbox-background": "url(/box.png)" })} />
 */
export function Textbox(handle: Handle<Textbox.Props>) {
	let player = handle.context.get(NovelPlayer);
	player.read.addEventListener("change", () => void handle.update(), {
		signal: listenerSignal(handle),
	});
	return () => {
		let { children, mix, ...rest } = handle.props;
		if (player.hidden || player.ending !== undefined || player.frame?.type !== "line") return null;
		return (
			<section
				{...rest}
				data-novel-textbox=""
				data-novel-read={player.read.current ? "" : undefined}
				aria-live="polite"
				mix={[
					css({
						position: themeVar("--novel-textbox-position") as "absolute",
						inset: themeVar("--novel-textbox-inset"),
						marginInline: "auto",
						maxInlineSize: themeVar("--novel-textbox-max-inline-size"),
						minBlockSize: themeVar("--novel-textbox-min-block-size"),
						boxSizing: "border-box",
						padding: themeVar("--novel-textbox-padding"),
						border: themeVar("--novel-textbox-border"),
						borderImageSource: themeVar("--novel-textbox-border-image-source"),
						borderImageSlice: themeVar("--novel-textbox-border-image-slice"),
						borderImageWidth: themeVar("--novel-textbox-border-image-width"),
						borderImageOutset: themeVar("--novel-textbox-border-image-outset"),
						borderImageRepeat: themeVar("--novel-textbox-border-image-repeat"),
						borderRadius: themeVar("--novel-textbox-radius"),
						background: themeVar("--novel-textbox-background"),
						boxShadow: themeVar("--novel-textbox-shadow"),
						backdropFilter: themeVar("--novel-textbox-backdrop-filter"),
						color: themeVar("--novel-textbox-color"),
						fontFamily: themeVar("--novel-text-font"),
						letterSpacing: themeVar("--novel-text-tracking"),
						wordSpacing: themeVar("--novel-text-word-spacing"),
						fontSize: themeVar("--novel-text-size"),
						lineHeight: themeVar("--novel-text-leading"),
						zIndex: 3,
					}),
					mix,
				]}
			>
				{children ?? [<NamePlate key="name" />, <Line key="line" />, <NextIndicator key="next" />]}
			</section>
		);
	};
}

/**
 * The speakers of the current line, each in their color and joined with "&"; narration has none,
 * so nothing renders. A named speaker opens the characters screen on them when the player offers one.
 *
 * @example <NovelPlayer.NamePlate mix={css({ "--novel-nameplate-offset": "0 -120%" })} />
 */
export function NamePlate(handle: Handle<Textbox.PartProps>) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let { mix, ...rest } = handle.props;
		let frame = player.frame;
		if (frame?.type !== "line" || frame.speakers.length === 0) return null;
		let offersCharacters = [player.ids.encyclopedia, player.ids.characters].some(
			(id) => player.element?.querySelector(`#${id}`) instanceof HTMLDialogElement,
		);
		return (
			<p
				{...rest}
				data-novel-speaker=""
				mix={[
					css({
						margin: themeVar("--novel-nameplate-margin"),
						justifySelf: "start",
						inlineSize: "fit-content",
						translate: themeVar("--novel-nameplate-offset"),
						padding: themeVar("--novel-nameplate-padding"),
						borderRadius: themeVar("--novel-nameplate-radius"),
						borderImageSource: themeVar("--novel-nameplate-border-image-source"),
						borderImageSlice: themeVar("--novel-nameplate-border-image-slice"),
						borderImageWidth: themeVar("--novel-nameplate-border-image-width"),
						background: themeVar("--novel-nameplate-background"),
						color: themeVar("--novel-nameplate-color"),
						fontFamily: themeVar("--novel-nameplate-font-family"),
						fontSize: themeVar("--novel-nameplate-font-size"),
						fontWeight: themeVar("--novel-nameplate-font-weight"),
					}),
					mix,
				]}
			>
				{frame.speakers.map((speaker, index) => (
					<span key={speaker.id} style={{ color: speaker.color }}>
						{index > 0 ? " & " : null}
						<SpeakerName speaker={speaker} opens={offersCharacters} />
					</span>
				))}
			</p>
		);
	};
}

/** Props of {@link SpeakerName}. */
interface SpeakerNameProps {
	speaker: Speaker;
	/** True when the player offers a characters screen for the name to open. */
	opens: boolean;
}

/** One speaker's name, or the unknown-name label until the story introduces them. */
function SpeakerName(handle: Handle<SpeakerNameProps>) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let { speaker, opens } = handle.props;
		if (!speaker.introduced) return <>{player.labels.unknownName}</>;
		if (!opens) return <Message i18nKey={speaker.name} />;
		return (
			<button
				type="button"
				data-character={speaker.id}
				mix={[
					css({
						padding: 0,
						border: 0,
						background: "none",
						color: "inherit",
						font: "inherit",
						cursor: "pointer",
						"&:hover": { textDecoration: "underline" },
					}),
					on("click", () => player.showCharacter(speaker.id)),
				]}
			>
				<Message i18nKey={speaker.name} />
			</button>
		);
	};
}

/**
 * The current line, rendered through `Trans` with the player's markup and revealed by the
 * player's `reveal` behavior, reporting the whole line visible through `reveal()`. A line read
 * before carries `data-novel-read` and takes `--novel-read-color`.
 *
 * @example <NovelPlayer.Line mix={css({ textAlign: "center" })} />
 */
export function Line(handle: Handle<Textbox.PartProps>) {
	let player = handle.context.get(NovelPlayer);
	let element: HTMLElement | undefined;
	let writer: Typewriter | undefined;
	let writerFrame: string | undefined;
	let started = false;

	handle.signal.addEventListener("abort", () => writer?.dispose());
	player.reveal.addEventListener("change", () => void handle.update(), {
		signal: listenerSignal(handle),
	});
	player.read.addEventListener("change", () => void handle.update(), {
		signal: listenerSignal(handle),
	});

	/** Keeps the DOM typewriter in step with the reveal model after each commit. */
	function sync(): void {
		let frame = player.frame;
		let reveal = player.reveal;
		if (element === undefined || frame?.type !== "line") return;
		if (writerFrame !== frame.id || writer === undefined) {
			writer?.dispose();
			let created = new Typewriter(element);
			writer = created;
			writerFrame = frame.id;
			started = false;
			void created.done.then(() => {
				if (writer === created && reveal.line === frame.id) reveal.reveal();
			});
		}
		if (reveal.status === "typing" && !started) {
			started = true;
			writer.start(reveal.speed);
		}
		if (reveal.complete && started) writer.finish();
	}

	return () => {
		let { mix, ...rest } = handle.props;
		let frame = player.frame;
		if (frame?.type !== "line") return null;
		handle.queueTask(sync);
		return (
			<p
				{...rest}
				data-novel-line=""
				data-frame={frame.id}
				data-novel-read={player.read.current ? "" : undefined}
				mix={[
					ref((node) => {
						element = node;
						sync();
					}),
					css({
						margin: 0,
						textWrap: "pretty",
						color: themeVar("--novel-text-color"),
						textShadow: themeVar("--novel-text-shadow"),
						"&[data-novel-read]": {
							color: `var(--novel-read-color, ${themeVar("--novel-text-color")})`,
						},
					}),
					typewriterText(),
					mix,
				]}
			>
				<Message key={frame.id} i18nKey={frame.key} values={frame.values} markup={player.markup} />
			</p>
		);
	};
}

/**
 * The next-line indicator, shown once a line is fully revealed and waits for the reader. It is
 * drawn by CSS (`--novel-next-content` or `--novel-next-image`), so it adds no text to the box,
 * in the textbox's top corner opposite the name, clear of a quick menu along the bottom edge.
 *
 * @example <NovelPlayer.NextIndicator mix={css({ "--novel-next-content": '"▶"' })} />
 */
export function NextIndicator(handle: Handle<Omit<TagProps<"span">, "children">>) {
	let player = handle.context.get(NovelPlayer);
	return () => {
		let { mix, ...rest } = handle.props;
		if (player.frame?.type !== "line" || player.phase !== "waiting") return null;
		return (
			<span
				{...rest}
				data-novel-next=""
				aria-hidden="true"
				mix={[
					css({
						position: "absolute",
						inset: themeVar("--novel-next-inset"),
						inlineSize: themeVar("--novel-next-size"),
						blockSize: themeVar("--novel-next-size"),
						display: "grid",
						placeItems: "center",
						color: themeVar("--novel-next-color"),
						backgroundImage: themeVar("--novel-next-image"),
						backgroundSize: "contain",
						backgroundRepeat: "no-repeat",
						fontSize: themeVar("--novel-next-size"),
						lineHeight: 1,
						animation: themeVar("--novel-next-animation"),
						"&::after": { content: themeVar("--novel-next-content") },
						"@keyframes novel-next": { from: { translate: "0 0" }, to: { translate: "0 25%" } },
						"@media (prefers-reduced-motion: reduce)": { animation: "none" },
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Shows the captions of the sounds a frame started, for readers who play without sound. Inside
 * a player it follows the frame and hides with the interface; `sounds` captions a fixed list.
 *
 * @example <NovelPlayer.Captions />
 */
export function Captions(handle: Handle<Textbox.CaptionsProps>) {
	let player = handle.context.get(NovelPlayer) as NovelPlayer.Context | undefined;
	return () => {
		let { sounds, mix, ...rest } = handle.props;
		let shown = sounds ?? frameSounds(player);
		if (shown === undefined) return null;
		let captioned = shown.filter((sound) => sound.caption !== undefined);
		return (
			<ul
				{...rest}
				data-novel-captions=""
				data-novel-ui=""
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
							background: themeVar("--novel-caption-background"),
							color: themeVar("--novel-caption-color"),
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

/** The sounds a player's frame started, or `undefined` while there is nothing to caption. */
function frameSounds(player: NovelPlayer.Context | undefined): AudioSound[] | undefined {
	if (player === undefined || player.hidden || player.ending !== undefined) return undefined;
	return player.frame?.audio.sounds;
}
