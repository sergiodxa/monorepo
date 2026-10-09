/**
 * The page-wide side of a named option group: the scope that hands every strip the
 * reader's picks, and the island that records a switch and carries it to the other
 * strips on the page.
 *
 * Each strip keeps a radio group of its own, because radios that share a name are one
 * group and checking a tab in the first strip would blank every other strip's panel.
 * Cross-strip agreement is therefore the island's job, and the page reads correctly
 * without it: a strip switches its own block through CSS alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { hidden } from "@sdxc/u/layout";
import { clientEntry, ref } from "remix/component";

import type { OptionGroupName, OptionSelections } from "~/app/services/option-groups";

import {
	OPTIONS_COOKIE_MAX_AGE,
	OPTIONS_COOKIE_NAME,
	parseOptionSelections,
	selectedOption,
	selectOption,
	serializeOptionSelections,
} from "~/app/services/option-groups";

namespace OptionGroupScope {
	export interface Props {
		children: RemixNode;
		/** The reader's pick per group, as the request's cookie spells it. */
		selections: OptionSelections | undefined;
	}
}

/**
 * Publishes the request's selections to every strip rendered beneath it, so a strip
 * written inside a markdown document reaches them without the document passing props.
 */
export default function OptionGroupScope(
	handle: Handle<OptionGroupScope.Props, OptionSelections | undefined>,
) {
	handle.context.set(handle.props.selections);

	return () => handle.props.children;
}

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type OptionGroupSyncProps = {
	/** The axis the strip this sits in belongs to. */
	group: OptionGroupName;
};

/**
 * Client island: remembers the option a reader switches to and checks it in the other
 * strips on the page. It owns no markup — it listens to the strip it sits in, which is
 * what keeps one switch to one cookie write however many strips the page carries.
 */
export const OptionGroupSync = clientEntry(
	import.meta.url,
	function OptionGroupSync(handle: Handle<OptionGroupSyncProps>) {
		return () => (
			<span
				mix={[
					hidden(),
					ref((node, signal) => {
						let { group } = handle.props;

						let strip = node.closest<HTMLElement>("[data-option-group]");
						if (!strip) return;

						/** A page served from a cache was rendered for whoever asked for it first. */
						check(strip, selectedOption(readSelections(), group));

						strip.addEventListener(
							"change",
							(event) => {
								let target = event.target;
								if (!(target instanceof HTMLInputElement)) return;

								let option = target.getAttribute("data-option-value");
								if (option === null) return;

								writeSelections(selectOption(readSelections(), group, option));

								let strips = document.querySelectorAll<HTMLElement>(
									`[data-option-group="${group}"]`,
								);
								for (let other of strips) if (other !== strip) check(other, option);
							},
							{ signal },
						);
					}),
				]}
			/>
		);
	},
);

/** Checks the control standing for `option`, leaving a strip that offers other options alone. */
function check(strip: HTMLElement, option: string): void {
	let input = strip.querySelector(`input[data-option-value="${CSS.escape(option)}"]`);
	if (input instanceof HTMLInputElement) input.checked = true;
}

/**
 * Reads the picks the browser holds. A reader who blocks cookies, or who edited this
 * one by hand, gets the same answer as a reader who has chosen nothing.
 */
function readSelections(): OptionSelections {
	try {
		for (let entry of document.cookie.split(";")) {
			let separator = entry.indexOf("=");
			if (entry.slice(0, separator).trim() !== OPTIONS_COOKIE_NAME) continue;
			return parseOptionSelections(decodeURIComponent(entry.slice(separator + 1)));
		}
	} catch {}

	return parseOptionSelections(null);
}

/** Records the picks for the next request, and lets a blocked store pass silently. */
function writeSelections(selections: OptionSelections): void {
	try {
		let value = encodeURIComponent(serializeOptionSelections(selections));
		let secure = location.protocol === "https:" ? "; Secure" : "";

		document.cookie = `${OPTIONS_COOKIE_NAME}=${value}; Path=/; Max-Age=${OPTIONS_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
	} catch {}
}
