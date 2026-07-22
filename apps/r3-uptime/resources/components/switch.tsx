/**
 * A toggle switch for boolean form fields — a track+thumb pill that slides between
 * on/off, matching the design used across the product. Composes `@pkg/r3-ui`'s
 * `Switch` (a native `<input type="checkbox" role="switch">` styled entirely
 * through CSS pseudo-classes, no client JS) nested inside its `Label`, so the
 * label text passed as `children` stays associated with the control through the
 * platform's own implicit `<label>` wrapping — no `id`/`aria-label` bookkeeping
 * needed at this app's call sites, which all pass `children` as the switch's
 * visible label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Label, Switch as UISwitch } from "@pkg/r3-ui";
import { css } from "remix/ui";

namespace Switch {
	export interface Props {
		/** The checkbox's `name`; submitted as `"true"` when the switch is on. */
		name: string;
		/** Whether the switch starts on. */
		defaultChecked?: boolean;
		disabled?: boolean;
		/** Label text rendered next to the track. */
		children: RemixNode;
	}
}

/** Renders a track+thumb switch backed by a visually-hidden native checkbox, labeled by `children`. */
export default function Switch(handle: Handle<Switch.Props>) {
	return () => {
		let { name, defaultChecked, disabled, children } = handle.props;

		return (
			<Label
				mix={[
					css({
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 16,
						fontWeight: 400,
						cursor: disabled ? "not-allowed" : "pointer",
					}),
				]}
			>
				<UISwitch name={name} value="true" defaultChecked={defaultChecked} disabled={disabled} />
				{children}
			</Label>
		);
	};
}
