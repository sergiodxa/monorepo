/**
 * The endings list: every ending the scenes can reach, found statically in their directive
 * arrays, with the reached ones named and the rest hidden, and how many of them the reader has
 * reached in any playthrough.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { intl } from "@sdxc/i18n/ui";
import { css } from "remix/component";

import type { Novel } from "../novel.js";

import type { NovelLabels } from "./settings.js";

import { libraryReader } from "./library.js";
import { Message } from "./message.js";
import { DEFAULT_LABELS } from "./settings.js";

export namespace EndingsList {
	/** Props {@link EndingsList} accepts. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		novel: Novel;
		/** The stored `Persistent` value, or a play's `persistent`; keep one value while it shows. */
		persistent: unknown;
		labels?: Partial<Pick<NovelLabels, "loading" | "unknownEnding">>;
	}
}

/**
 * Lists the endings in the order the scenes hold them, under a count of those reached.
 *
 * @example <EndingsList novel={novel} persistent={stored} />
 */
export function EndingsList(handle: Handle<EndingsList.Props>) {
	let read = libraryReader(handle);
	return () => {
		let { novel, persistent, labels: overrides, mix, ...rest } = handle.props;
		let labels = { ...DEFAULT_LABELS, ...overrides };
		let library = read(novel, persistent, intl(handle).locale);
		let endings = library?.endings ?? [];
		let reached = endings.filter((ending) => ending.reached).length;
		return (
			<div
				{...rest}
				data-novel-endings=""
				aria-busy={library === undefined ? "true" : undefined}
				mix={[css({ display: "grid", gap: "0.75rem" }), mix]}
			>
				{library === undefined ? (
					<p>{labels.loading}</p>
				) : (
					<p
						data-novel-endings-count=""
						mix={css({ margin: 0, fontVariantNumeric: "tabular-nums" })}
					>
						{`${reached} / ${endings.length}`}
					</p>
				)}
				<ol mix={css({ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" })}>
					{endings.map((ending) => (
						<li
							key={ending.key}
							data-ending={ending.reached ? ending.key : undefined}
							data-reached={String(ending.reached)}
							mix={css({ '&[data-reached="false"]': { opacity: 0.6 } })}
						>
							{ending.reached ? <Message i18nKey={ending.key} /> : labels.unknownEnding}
						</li>
					))}
				</ol>
			</div>
		);
	};
}
