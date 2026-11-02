/**
 * The shapes Inkwell's frames draw while their part loads: a text bar that keeps the line it
 * sits on at its real height, and a region whose minimum height holds a part whose own height
 * follows how its lines wrap, so the page below it stays put when the part lands.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { Description, Label } from "@sdxc/ui";
import { Skeleton } from "@sdxc/ui/app/skeleton";

/** Props accepted by {@link TextBar}. */
interface TextBarProps {
	/** How much of the line the bar covers, as a CSS length. */
	width: string;
}

/**
 * A placeholder bar on a text line. It is inline and shorter than the line, so the line keeps
 * the height the text it stands in for gives it; place it inside the same typography.
 */
export function TextBar(handle: Handle<TextBarProps>) {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					display: "inline-block",
					verticalAlign: "middle",
					inlineSize: handle.props.width,
					maxInlineSize: "100%",
					blockSize: "0.75em",
					borderRadius: "var(--ui-radius-sm)",
					backgroundColor: "var(--ui-neutral-border)",
				}),
			]}
		/>
	);
}

/** Props accepted by {@link FrameRegion}. */
interface FrameRegionProps {
	/** The region's minimum height below 30rem of width, where lines wrap more. */
	narrow: string;
	/** The region's minimum height from 30rem of width up. */
	wide: string;
	children: RemixNode;
}

/**
 * Holds a part whose height follows how its lines wrap. The minimum height covers the part at
 * every common width of its column, so the placeholder and the part fill the same box; a part
 * the visitor opens further, such as a folded run of events, grows past it.
 */
export function FrameRegion(handle: Handle<FrameRegionProps>) {
	return () => {
		let { narrow, wide, children } = handle.props;
		return (
			<div mix={[raw({ containerType: "inline-size", containerName: "inkwell-region" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							minBlockSize: wide,
							"@container inkwell-region (max-width: 29.999rem)": { minBlockSize: narrow },
						}),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/** Props accepted by {@link FieldShape}. */
interface FieldShapeProps {
	label: string;
	/** The space between the label, the control and the description, matching the field's own. */
	gap: string;
	/** The field's description, or `true` for one line of data that loads with the field. */
	description?: string | true;
}

/**
 * A form field while its values load: the real label, a box at the control's height and the
 * description's line, spaced like the field, so a form keeps its height when the values land.
 */
export function FieldShape(handle: Handle<FieldShapeProps>) {
	return () => {
		let { label, gap, description } = handle.props;
		return (
			<div mix={[vstack({ gap, align: "stretch" })]}>
				<Label>{label}</Label>
				<Skeleton mix={[raw({ blockSize: "2.5rem" })]} />
				{description === undefined ? null : (
					<Description>{description === true ? <TextBar width="70%" /> : description}</Description>
				)}
			</div>
		);
	};
}
