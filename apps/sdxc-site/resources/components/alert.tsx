/**
 * GitHub-style `> [!KIND]` alerts: a short aside beside the argument it qualifies. It is
 * an `<aside>` rather than a live region, because the text is there when the page
 * loads and nothing updates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	InfoIcon,
	LightbulbIcon,
	MessageSquareWarningIcon,
	OctagonAlertIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, inlineFlex, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { semanticColorPanel } from "@sdxc/ui/styles";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

namespace Alert {
	/** The five kinds GitHub's alert syntax names, from adding a fact to warning of a loss. */
	export type Kind = "note" | "tip" | "important" | "warning" | "caution";
}

/**
 * The label, tint and glyph each kind draws with, so every kind reads apart by its
 * shape as well as its color. The label doubles as the aside's accessible name.
 */
const ALERT_KINDS: Record<Alert.Kind, { label: string; color: string; Glyph: typeof InfoIcon }> = {
	note: { label: "Note", color: "brand", Glyph: InfoIcon },
	tip: { label: "Tip", color: "success", Glyph: LightbulbIcon },
	important: { label: "Important", color: "neutral", Glyph: MessageSquareWarningIcon },
	warning: { label: "Warning", color: "warning", Glyph: TriangleAlertIcon },
	caution: { label: "Caution", color: "danger", Glyph: OctagonAlertIcon },
};

/** Narrows the parsed kind, so a kind the table lacks still draws as a note. */
function isKind(kind: unknown): kind is Alert.Kind {
	return typeof kind === "string" && kind in ALERT_KINDS;
}

/**
 * Renders one alert, tinted by its kind and opened by the kind's glyph and label, so a
 * screen reader announces what the aside is before reading it.
 */
export default function Alert(handle: Handle<MarkdownProps>) {
	return () => {
		let { children, kind } = handle.props;
		let { label, color, Glyph } = ALERT_KINDS[isKind(kind) ? kind : "note"];

		return (
			<aside
				aria-label={label}
				data-color={color}
				mix={[
					semanticColorPanel(),
					vstack({ gap: 2 }),
					blocksUseGap(),
					p(4, 5),
					rounded("lg"),
					border({ width: 1, style: "solid" }),
					text("sm"),
				]}
			>
				<p
					mix={[
						m(0),
						hstack({ gap: 2, align: "center" }),
						font("mono"),
						text("xs"),
						weight("semibold"),
						textTransform("uppercase"),
						tracking("widest"),
					]}
				>
					<span mix={[inlineFlex()]}>
						<Glyph size={14} aria-hidden="true" />
					</span>
					{label}
				</p>
				{children}
			</aside>
		);
	};
}
