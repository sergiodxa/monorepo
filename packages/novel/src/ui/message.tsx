/**
 * Renders one of the story's messages through `Trans`, with the inline effects a line's
 * MessageFormat markup names: `{#b}`, `{#i}`, `{#shake}`, `{#speed rate=…}` and `{#pause ms=…/}`.
 * Frames carry keys as plain strings, so this is where an untyped key meets the typed catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixElement } from "remix/component";

import { Trans } from "@sdxc/i18n/ui";
import { css } from "remix/component";

export namespace Message {
	/** Props {@link Message} accepts. */
	export interface Props {
		/** The message key a frame carries. */
		i18nKey: string;
		values?: Record<string, unknown> | undefined;
		/** Elements or markup components for more names, or replacements for the built-in ones. */
		markup?: Record<string, RemixElement | Trans.MarkupComponent>;
	}
}

/** `Trans` with its key and values taken as plain strings and records, as frames carry them. */
type UntypedTrans = (
	handle: Handle<{
		i18nKey: string;
		values?: Record<string, unknown>;
		components?: Record<string, RemixElement | Trans.MarkupComponent>;
	}>,
) => () => RemixElement;

/** The typing rate `{#speed}` sets without a `rate` option: half the reader's text speed. */
const DEFAULT_SPEED_RATE = 0.5;

/**
 * Reads a positive number from a markup option, which arrives as a string when the message
 * writes it literally and as the passed value when it names a variable.
 */
function positive(value: unknown): number | undefined {
	let number = typeof value === "number" ? value : Number(value);
	return typeof value !== "boolean" && value !== "" && Number.isFinite(number) && number > 0
		? number
		: undefined;
}

/**
 * `{#speed rate=…}…{/speed}`: types its content at `rate` times the reader's text speed (`2`
 * twice as fast, `0.25` at a quarter), half speed without the option, so a slow line stays
 * relative to the speed the reader chose.
 */
function Speed(handle: Handle<Trans.MarkupProps>) {
	return () => (
		<span data-typewriter-speed={String(positive(handle.props.options.rate) ?? DEFAULT_SPEED_RATE)}>
			{handle.props.children}
		</span>
	);
}

/** `{#pause ms=…/}`: holds the typewriter for `ms` milliseconds, 400 without the option. */
function Pause(handle: Handle<Trans.MarkupProps>) {
	return () => {
		let ms = positive(handle.props.options.ms);
		return <span data-typewriter-pause={ms === undefined ? "" : String(ms)} />;
	};
}

/**
 * The effects a line's markup can name. `shake` loops, `speed` types its content at `rate` times
 * the reader's speed (half without it), and the standalone `pause` holds the typewriter for `ms`
 * (400 without it); an app overrides any of them with {@link Message.Props.markup}.
 *
 * @returns A fresh components map for `Trans`.
 * @example lineMarkup().speed; // renders "{#speed rate=0.25}…{/speed}" at a quarter speed
 */
export function lineMarkup(): Record<string, RemixElement | Trans.MarkupComponent> {
	return {
		b: <b />,
		i: <i />,
		shake: (
			<span
				data-novel-effect="shake"
				mix={css({
					display: "inline-block",
					animation: "novel-text-shake 0.25s linear infinite",
					"@keyframes novel-text-shake": {
						"0%, 100%": { translate: "0 0" },
						"25%": { translate: "-0.04em 0.03em" },
						"50%": { translate: "0.04em -0.03em" },
						"75%": { translate: "-0.03em -0.04em" },
					},
					"@media (prefers-reduced-motion: reduce)": { animation: "none" },
				})}
			/>
		),
		speed: Speed,
		pause: Pause,
	};
}

/**
 * Renders a message with the built-in line effects, plus any the app adds.
 *
 * @example <Message i18nKey={frame.key} values={frame.values} />
 */
export function Message(handle: Handle<Message.Props>) {
	return () => {
		let { i18nKey, values, markup } = handle.props;
		let Translate = Trans as unknown as UntypedTrans;
		return (
			<Translate
				i18nKey={i18nKey}
				values={values}
				components={markup === undefined ? lineMarkup() : { ...lineMarkup(), ...markup }}
			/>
		);
	};
}
