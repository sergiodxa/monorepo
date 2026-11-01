/**
 * The labels on one kept post, and the way to put another on it. Both surfaces that draw
 * labels print the same strip beneath a post's title, so the markup lives here. The field
 * for a new label waits behind a small disclosure, so a list of kept posts reads as posts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { PlusIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, listStyle, raw } from "@sdxc/u/general";
import { flex, flexWrap, gap, inlineFlex, items } from "@sdxc/u/layout";
import { bs, is, maxIs, mbs, minIs, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, textDecoration } from "@sdxc/u/typography";
import { TagGroup } from "@sdxc/ui";
import { attrs } from "remix/component";

/** Height of the strip's own controls, which keeps a chip a chip rather than a button. */
const CHIP_HEIGHT = "1.5rem";

/** Width the field for a new label holds, which is a label's length and no more. */
const FIELD_WIDTH = "9rem";

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
		/** The disclosure, and the field it opens, that put another label on the post. */
		add: string;
		placeholder: string;
		/** Takes one label off, said with the label's own name. */
		remove: string;
	}

	export interface Props {
		/** The labels on this post, which may be none. */
		chips: Chip[];
		/** Where a label is put on this post. */
		applyAction: string;
		/** The page the forms return to, which is the page being rendered. */
		returnTo: string;
		/** The list of names the field offers, drawn once for the page that holds it. */
		optionsId: string;
		copy: Copy;
	}
}

/** Renders a post's labels as a group of tags, then the disclosure that adds one. */
export default function TagChips(handle: Handle<TagChips.Props>) {
	return () => {
		let { applyAction, chips, copy, optionsId, returnTo } = handle.props;

		return (
			<div mix={[flex(), flexWrap(), items("center"), gap(2), mbs(1)]}>
				{chips.length > 0 && (
					<TagGroup aria-label={copy.legend}>
						<TagGroup.List>
							{chips.map((chip) => (
								<TagGroup.Tag key={chip.id} size="sm">
									<a href={chip.href} mix={[raw({ color: "inherit" }), textDecoration("none")]}>
										{chip.name}
									</a>

									{/**
									 * A form per label, so taking one off works without script. A browser
									 * form sends `GET` and `POST` alone, so `_method` carries the `DELETE`.
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
				)}

				{/**
				 * Closed until asked for, so a list of kept posts is not a column of empty fields.
				 * A disclosure rather than a script, so it opens with any browser.
				 */}
				<details mix={[inlineFlex(), items("center")]}>
					<summary
						aria-label={copy.add}
						title={copy.add}
						mix={[
							inlineFlex(),
							items("center"),
							gap(1),
							bs(CHIP_HEIGHT),
							p(0, 2),
							rounded("full"),
							border({ color: "neutral.border", width: 1 }),
							text("xs"),
							fg("neutral.muted"),
							cursor("pointer"),
							listStyle(),
							when("&::-webkit-details-marker", raw({ display: "none" })),
							hover([fg("neutral.emphasis"), bg("neutral.bg-tint-hover")]),
						]}
					>
						<PlusIcon size={12} aria-hidden="true" />
					</summary>

					<form
						method="post"
						action={applyAction}
						mix={[
							attrs({ "data-rmx-document": "" }),
							inlineFlex(),
							items("center"),
							raw({ marginInlineStart: "0.5rem" }),
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
								bs(CHIP_HEIGHT),
								p(0, 2),
								rounded("full"),
								border({ color: "neutral.border", width: 1 }),
								bg("neutral.bg"),
								fg("neutral.emphasis"),
								raw({ font: "inherit", fontSize: "0.75rem" }),
							]}
						/>
					</form>
				</details>
			</div>
		);
	};
}
