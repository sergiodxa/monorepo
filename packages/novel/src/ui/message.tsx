/**
 * Renders one of the story's messages through `Trans`, with the inline effects a line's
 * MessageFormat markup names: `{#b}`, `{#i}`, `{#shake}`, `{#speed}` and `{#pause/}`. Frames carry
 * keys as plain strings, so this is where an untyped key meets the app's typed catalog.
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
		/** Elements for more markup names, or replacements for the built-in ones. */
		markup?: Record<string, RemixElement>;
	}
}

/** `Trans` with its key and values taken as plain strings and records, as frames carry them. */
type UntypedTrans = (
	handle: Handle<{
		i18nKey: string;
		values?: Record<string, unknown>;
		components?: Record<string, RemixElement>;
	}>,
) => () => RemixElement;

/**
 * The effects a line's markup can name. `shake` loops, `speed` halves the typewriter inside it,
 * and the standalone `pause` holds the typewriter for 400ms; an app overrides any of them, or a
 * pause's length through `data-novel-pause`, with {@link Message.Props.markup}.
 *
 * @returns A fresh components map for `Trans`.
 */
export function lineMarkup(): Record<string, RemixElement> {
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
		speed: <span data-novel-speed="0.5" />,
		pause: <span data-novel-pause="" />,
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
