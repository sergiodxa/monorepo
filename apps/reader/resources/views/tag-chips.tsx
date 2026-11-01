/**
 * The labels on one kept post, and the control that puts another on it. The labels show
 * under the post's title only when it has some, and adding one is a quiet mark beside the
 * save mark that opens a small field, so a list of kept posts reads as posts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { TagIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { inlineFlex } from "@sdxc/u/layout";
import { bs, is, maxIs, mbs, minIs, p } from "@sdxc/u/size";
import { textDecoration } from "@sdxc/u/typography";
import { Button, TagGroup } from "@sdxc/ui";
import { attrs } from "remix/component";

/** Height of the field for a new label, which keeps it the size of the chips it makes. */
const FIELD_HEIGHT = "1.75rem";

/** Width the field for a new label holds, which is a label's length and no more. */
const FIELD_WIDTH = "12rem";

/** Edge of the square the label mark sits in, matching the save mark beside it. */
const MARK_SIZE = "1.75rem";

export namespace TagChips {
	/** One label on this post, and the way to take it off again. */
	export interface Chip {
		id: string;
		name: string;
		/** Where the posts under this label are read. */
		href: string;
		/** Where taking it off this post is submitted. */
		removeAction: string;
	}

	/** The translated copy the strip prints, which is the same on every surface. */
	export interface Copy {
		/** Names the strip for anyone listening to it. */
		legend: string;
		/** The control, and the field it opens, that put another label on the post. */
		add: string;
		placeholder: string;
		/** Takes one label off, said with the label's own name. */
		remove: string;
	}

	export interface Props {
		/** The labels on this post, which may be none. */
		chips: Chip[];
		/** The page the forms return to, which is the page being rendered. */
		returnTo: string;
		copy: Copy;
	}

	export interface AddProps {
		/** Where a label is put on this post. */
		applyAction: string;
		/** The page the form returns to, which is the page being rendered. */
		returnTo: string;
		/** The list of names the field offers, drawn once for the page that holds it. */
		optionsId: string;
		copy: Copy;
	}
}

/**
 * A post's labels as a group of tags, each a way into what else is kept under it. A post
 * with no labels draws nothing, so its row keeps to one line.
 */
export default function TagChips(handle: Handle<TagChips.Props>) {
	return () => {
		let { chips, copy, returnTo } = handle.props;
		if (chips.length === 0) return null;

		return (
			<TagGroup aria-label={copy.legend} mix={[mbs(1)]}>
				<TagGroup.List mix={[raw({ gap: "0.375rem" })]}>
					{chips.map((chip) => (
						<TagGroup.Tag key={chip.id} size="sm">
							<a href={chip.href} mix={[raw({ color: "inherit" }), textDecoration("none")]}>
								{chip.name}
							</a>

							{/**
							 * A form per label, so taking one off works without script. A browser form
							 * sends `GET` and `POST` alone, so `_method` carries the `DELETE`.
							 */}
							<form
								method="post"
								action={chip.removeAction}
								mix={[attrs({ "data-rmx-document": "" }), inlineFlex()]}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="returnTo" value={returnTo} />
								<TagGroup.Remove
									aria-label={`${copy.remove} ${chip.name}`}
									title={`${copy.remove} ${chip.name}`}
								/>
							</form>
						</TagGroup.Tag>
					))}
				</TagGroup.List>
			</TagGroup>
		);
	};
}

/**
 * The quiet mark that labels a post: a popover holding one field, anchored under the mark.
 * The popover is the browser's own, so it opens without script and closes on Escape or a
 * click elsewhere.
 */
export function AddLabel(handle: Handle<TagChips.AddProps>) {
	return () => {
		let { applyAction, copy, optionsId, returnTo } = handle.props;

		/** One id per post, read off the address the label is put at, which names the post. */
		let key = applyAction.replace(/[^a-zA-Z0-9]+/g, "-");
		let popoverId = `add-label${key}`;
		let anchor = `--add-label${key}`;

		return (
			<>
				<Button
					type="button"
					popovertarget={popoverId}
					color="neutral"
					variant="ghost"
					size="sm"
					aria-label={copy.add}
					title={copy.add}
					style={{ anchorName: anchor }}
					mix={[raw({ padding: "0" }), is(MARK_SIZE), bs(MARK_SIZE), fg("neutral.muted")]}
				>
					<TagIcon size={16} aria-hidden="true" />
				</Button>

				<form
					id={popoverId}
					popover="auto"
					method="post"
					action={applyAction}
					style={{ positionAnchor: anchor }}
					mix={[
						attrs({ "data-rmx-document": "" }),
						raw({
							margin: "0",
							insetBlockStart: "anchor(bottom)",
							insetInlineEnd: "anchor(end)",
							insetInlineStart: "auto",
							marginBlockStart: "0.25rem",
						}),
						p(2),
						rounded("lg"),
						border({ color: "neutral.border", width: 1 }),
						bg(),
						fg("neutral.emphasis"),
						shadow("lg"),
					]}
				>
					<input type="hidden" name="returnTo" value={returnTo} />

					{/** Labels already in use are offered as it is typed, so a second spelling takes effort. */}
					<input
						type="text"
						name="name"
						list={optionsId}
						required
						aria-label={copy.add}
						placeholder={copy.placeholder}
						mix={[
							is(FIELD_WIDTH),
							maxIs("100%"),
							minIs(0),
							bs(FIELD_HEIGHT),
							p(0, 2),
							rounded("md"),
							border({ color: "neutral.border", width: 1 }),
							bg(),
							fg("neutral.emphasis"),
							raw({ font: "inherit", fontSize: "0.8125rem" }),
						]}
					/>
				</form>
			</>
		);
	};
}
