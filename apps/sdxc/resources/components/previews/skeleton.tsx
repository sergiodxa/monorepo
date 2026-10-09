/**
 * Live preview island for `Skeleton`. A placeholder is only honest when it traces
 * the UI it stands in for, so the example is the loading state of a comment thread:
 * a round avatar, a name line, three lines of body copy at descending widths, and a
 * pair of action pills. The block itself holds still, so the `pulse()` factory a
 * reader composes through `mix` is what supplies the motion cue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Card, Skeleton } from "@sdxc/ui";
import { pulse } from "@sdxc/ui/animations";
import { clientEntry, css } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SKELETON_CODE = `<Card aria-busy="true" aria-label="Loading comments">
	<Card.Content>
		<div mix={[hstack({ gap: 3, align: "center" })]}>
			<Skeleton mix={[pulse(), css({ inlineSize: "2.5rem", blockSize: "2.5rem", borderRadius: "9999px", flexShrink: "0" })]} />
			<div mix={[vstack({ gap: 2, align: "stretch" }), css({ flexGrow: "1" })]}>
				<Skeleton mix={[pulse(), css({ inlineSize: "9rem" })]} />
				<Skeleton mix={[pulse(), css({ inlineSize: "5rem", blockSize: "0.75rem" })]} />
			</div>
		</div>

		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Skeleton mix={[pulse()]} />
			<Skeleton mix={[pulse()]} />
			<Skeleton mix={[pulse(), css({ inlineSize: "60%" })]} />
		</div>

		<div mix={[hstack({ gap: 2, align: "center" })]}>
			<Skeleton mix={[pulse(), css({ inlineSize: "4.5rem", blockSize: "2rem", borderRadius: "9999px" })]} />
			<Skeleton mix={[pulse(), css({ inlineSize: "4.5rem", blockSize: "2rem", borderRadius: "9999px" })]} />
		</div>
	</Card.Content>
</Card>`;

/** A comment thread's loading state, hydrated so the breathe runs as it would in an app. */
export const SkeletonPreview = clientEntry(import.meta.url, function SkeletonPreview() {
	return () => (
		<Card
			aria-busy="true"
			aria-label="Loading comments"
			/* Filling the frame keeps the placeholder the shape of the card it stands in for,
			 * rather than a small box adrift in the middle of one. */
			mix={[is("100%"), maxIs("34rem")]}
		>
			<Card.Content mix={[vstack({ gap: 5, align: "stretch" })]}>
				<div mix={[hstack({ gap: 3, align: "center" })]}>
					<Skeleton
						mix={[
							pulse(),
							css({
								inlineSize: "2.5rem",
								blockSize: "2.5rem",
								borderRadius: "9999px",
								flexShrink: "0",
							}),
						]}
					/>
					<div mix={[vstack({ gap: 2, align: "stretch" }), css({ flexGrow: "1" })]}>
						<Skeleton mix={[pulse(), css({ inlineSize: "9rem" })]} />
						<Skeleton mix={[pulse(), css({ inlineSize: "5rem", blockSize: "0.75rem" })]} />
					</div>
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Skeleton mix={[pulse()]} />
					<Skeleton mix={[pulse()]} />
					<Skeleton mix={[pulse(), css({ inlineSize: "60%" })]} />
				</div>

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<Skeleton
						mix={[
							pulse(),
							css({ inlineSize: "4.5rem", blockSize: "2rem", borderRadius: "9999px" }),
						]}
					/>
					<Skeleton
						mix={[
							pulse(),
							css({ inlineSize: "4.5rem", blockSize: "2rem", borderRadius: "9999px" }),
						]}
					/>
				</div>
			</Card.Content>
		</Card>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SKELETON_CODE, render: () => <SkeletonPreview /> };
