/**
 * The labels on one kept post, and the field that puts another on it.
 *
 * Both surfaces that draw labels print the same strip beneath a post's title — the list of
 * everything kept, and the list of what is kept under one label — so the markup lives here
 * and each controller supplies the chips and the copy.
 *
 * Every string arrives translated: interpolation and the dictionary belong to the
 * controller, which is where the request's language is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flex, flexWrap, gap, inlineFlex, items } from "@sdxc/u/layout";
import { bs, is, maxIs, mbs, minIs, p } from "@sdxc/u/size";
import { text, textDecoration } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

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
		/** The field that puts another label on the post. */
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

/** What a chip and the two controls beside it are drawn with. */
function chipShell() {
	return [
		inlineFlex(),
		items("center"),
		gap(1),
		bs(CHIP_HEIGHT),
		p(0, 2),
		rounded("full"),
		border({ color: "neutral.border", width: 1 }),
		bg("neutral.bg"),
		fg("neutral.muted"),
		text("xs"),
	];
}

/**
 * The labels on one post, each a way into the list of everything kept under it, and the
 * field that adds another.
 *
 * A label is a reason to have kept something, so the field keeps the post as it labels it:
 * one gesture, with no ordering between two verbs for a reader to get wrong.
 */
export default function TagChips(handle: Handle<TagChips.Props>) {
	return () => {
		let { applyAction, chips, copy, optionsId, returnTo } = handle.props;

		return (
			<div aria-label={copy.legend} mix={[flex(), flexWrap(), items("center"), gap(2), mbs(1)]}>
				{chips.map((chip) => (
					<span key={chip.id} mix={chipShell()}>
						<a href={chip.href} mix={[fg("neutral"), textDecoration("none")]}>
							{chip.name}
						</a>

						{/**
						 * Taking a label off is a submission rather than a link, since a prefetcher
						 * walks links of its own accord. The form posts `_method`, since a browser
						 * sends `GET` and `POST` alone and the override reads the `DELETE` back out.
						 */}
						<form
							method="post"
							action={chip.removeAction}
							mix={[attrs({ "data-rmx-document": "" }), inlineFlex()]}
						>
							<input type="hidden" name="_method" value="DELETE" />
							<input type="hidden" name="returnTo" value={returnTo} />

							<button
								type="submit"
								aria-label={`${copy.remove} ${chip.name}`}
								title={`${copy.remove} ${chip.name}`}
								mix={[
									inlineFlex(),
									items("center"),
									border("none"),
									bg("transparent"),
									fg("neutral.muted"),
									p(0),
									raw({ cursor: "pointer", font: "inherit", lineHeight: "1" }),
								]}
							>
								×
							</button>
						</form>
					</span>
				))}

				{/**
				 * One field and the return key, the way every other one-field control in this app
				 * is sent. It offers the names already in use so a second spelling of one label is
				 * something a reader has to go out of their way to type.
				 */}
				<form
					method="post"
					action={applyAction}
					mix={[attrs({ "data-rmx-document": "" }), inlineFlex(), items("center")]}
				>
					<input type="hidden" name="returnTo" value={returnTo} />

					{/**
					 * Named by its own label rather than by a word beside it: the strip is a row of
					 * chips, and a visible caption on it would be the loudest thing under a title.
					 */}
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
							text("xs"),
							raw({ font: "inherit", fontSize: "0.75rem" }),
						]}
					/>
				</form>
			</div>
		);
	};
}
