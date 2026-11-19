/**
 * Island holding a composer's formatting buttons: bold, italic, strikethrough, code, link,
 * quote and list, each writing its Markdown around the selection in the composer's field and
 * bound to the usual shortcut while the field has focus. It needs script, so it hides without.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import {
	BoldIcon,
	CodeIcon,
	ItalicIcon,
	LinkIcon,
	ListIcon,
	StrikethroughIcon,
	TextQuoteIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { hstack, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, minIs, pi } from "@sdxc/u/size";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";
import { keyComboGlyphs } from "../utils/key-combo.js";

import type { FormatAction } from "./utils/markdown-format.js";

import { FORMAT_SHORTCUTS, composerFormat } from "./mixins/composer-format.js";

export type { FormatAction, FormattedText } from "./utils/markdown-format.js";
export { applyFormat } from "./utils/markdown-format.js";

/** Every action, in the order the toolbar shows them when `actions` is omitted. */
const FORMAT_ACTIONS: readonly FormatAction[] = [
	"bold",
	"italic",
	"strike",
	"code",
	"link",
	"quote",
	"list",
];

/** The Lucide glyph each action's button shows. */
const ICONS = {
	bold: BoldIcon,
	italic: ItalicIcon,
	strike: StrikethroughIcon,
	code: CodeIcon,
	link: LinkIcon,
	quote: TextQuoteIcon,
	list: ListIcon,
} as const;

/** Whether the reader's keyboard prints Command, which decides the glyphs a title shows. */
function isApplePlatform(): boolean {
	if (typeof navigator === "undefined") return true;
	return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** A combo as `aria-keyshortcuts` spells it, such as `Meta+Shift+X`. */
function ariaShortcut(combo: string, apple: boolean): string {
	return combo
		.split("+")
		.map((token) => {
			if (token === "mod") return apple ? "Meta" : "Control";
			if (token === "shift") return "Shift";
			return token.toUpperCase();
		})
		.join("+");
}

/** Prop types for {@link ComposerFormat}. */
export namespace ComposerFormat {
	/** Plain data only, since the props cross into the browser with the island. */
	export type Props = {
		/** Each button's accessible name, such as `{ bold: "Bold", … }`; the title adds its shortcut. */
		labels: Record<FormatAction, string>;
		/** The buttons to show, in order. @default every action */
		actions?: FormatAction[];
		/** The `id` of the `<textarea>` to edit; the `Composer.Input` of the island's form when omitted. */
		target?: string;
	};
}

/**
 * Renders a row of small ghost buttons. Each edit goes through the browser's editing
 * commands, so Undo reverts it, and leaves the formatted text selected or the caret between
 * new markers. Mod+B, Mod+I, Mod+Shift+X and Mod+E work while the field has focus.
 *
 * @example
 * <Composer.Toolbar>
 * 	<ComposerFormat labels={{ bold: "Bold", italic: "Italic", strike: "Strikethrough", code: "Code", link: "Link", quote: "Quote", list: "List" }} />
 * </Composer.Toolbar>
 */
export const ComposerFormat: EntryComponent<ComposerFormat.Props> = clientEntry(
	"@sdxc/ui/chat/composer-format#ComposerFormat",
	function ComposerFormat(handle: Handle<ComposerFormat.Props>) {
		let apple = true;
		handle.queueTask(() => {
			let detected = isApplePlatform();
			if (detected === apple || handle.signal.aborted) return;
			apple = detected;
			void handle.update();
		});

		return () => {
			let { labels, actions = FORMAT_ACTIONS, target } = handle.props;
			return (
				<span
					data-slot="composer-format"
					mix={[
						composerFormat({ actions, target }),
						hstack({ gap: 0.5, align: "center" }),
						media("(scripting: none)", raw({ display: "none" })),
					]}
				>
					{actions.map((action) => {
						let Icon = ICONS[action];
						let combo = FORMAT_SHORTCUTS[action];
						let label = labels[action];
						let keys =
							combo === undefined ? null : keyComboGlyphs(combo, apple).join(apple ? "" : "+");
						return (
							<Button
								key={action}
								type="button"
								variant="ghost"
								color="neutral"
								size="sm"
								aria-label={label}
								title={keys === null ? label : `${label} (${keys})`}
								aria-keyshortcuts={combo === undefined ? undefined : ariaShortcut(combo, apple)}
								data-format={action}
								mix={[is("2rem"), bs("2rem"), minIs("2rem"), pi(0), shrink(0)]}
							>
								<Icon size={16} aria-hidden="true" />
							</Button>
						);
					})}
				</span>
			);
		};
	},
);
