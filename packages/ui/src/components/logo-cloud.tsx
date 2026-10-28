/**
 * A wrapping row of adopter marks for marketing proof strips. Each child is
 * forced to the marketing logo height with muted currentColor treatment so
 * the row reads as one quiet band.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { raw, var as varUtility } from "@sdxc/u/general";
import { flexWrap, gap, inlineFlex, items, justify } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";

/** Forced height each direct child mark settles at. */
const LOGO_HEIGHT = varUtility("ui-marketing-logo-height", "1rem");

/**
 * Prop types for {@link LogoCloud}.
 */
export namespace LogoCloud {
	/**
	 * Props accepted by {@link LogoCloud}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Softens the whole row further through the muted foreground token.
		 * Individual marks already carry `logoCloudMark()` opacity.
		 */
		muted?: boolean;
		/**
		 * Consumer-supplied marks — {@link Logo}, `<img>`, or inline SVG
		 * children. The cloud applies mark sizing to each direct child.
		 */
		children: RemixNode;
	}
}

/**
 * Lays logo children in a wrapping, centered row and forces each direct child
 * to the marketing logo height with muted currentColor treatment.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the cloud's markup.
 * @example
 * <LogoCloud muted>
 * 	<img src={acme} alt="" />
 * 	<img src={globex} alt="" />
 * </LogoCloud>
 */
export function LogoCloud(handle: Handle<LogoCloud.Props>) {
	return () => {
		let { mix, muted, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-muted={muted ? "true" : undefined}
				data-slot="logo-cloud"
				mix={[
					inlineFlex(),
					flexWrap(),
					items("center"),
					justify("center"),
					gap(6),
					muted ? fg("neutral.muted") : fg("neutral"),
					when("& > *", [
						bs(LOGO_HEIGHT),
						is("auto"),
						opacity(65),
						raw({ objectFit: "contain", color: "currentColor" }),
					]),
					mix,
				]}
			/>
		);
	};
}
