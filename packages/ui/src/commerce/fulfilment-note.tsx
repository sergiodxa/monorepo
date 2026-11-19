/**
 * A quiet line saying how an item reaches the buyer: a download, a parcel, or a pickup. It
 * sits under a cart line or a product's price, with an icon naming the way so a mixed cart
 * of prints and digital files reads at a glance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { DownloadIcon, StoreIcon, TruckIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";

/** Prop types for {@link FulfilmentNote}. */
export namespace FulfilmentNote {
	/** How the item reaches the buyer. */
	export type Kind = "download" | "ships" | "pickup";

	/** Props accepted by {@link FulfilmentNote}; the host is a `<span>`. */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		kind: Kind;
		/** The words, such as "Instant download" or "Ships in 3–5 days". */
		children: RemixNode;
	}
}

/**
 * Renders an inline icon and text in small muted type, so it flows inside a line of details
 * or stands alone under a price. The kind is written to `data-kind` for a page to style by.
 *
 * @example <FulfilmentNote kind="download">Instant download</FulfilmentNote>
 * @example <FulfilmentNote kind="ships">Ships in 3–5 days</FulfilmentNote>
 */
export function FulfilmentNote(handle: Handle<FulfilmentNote.Props>) {
	return () => {
		let { children, kind, mix, ...rest } = handle.props;
		return (
			<span
				{...rest}
				data-slot="fulfilment-note"
				data-kind={kind}
				mix={mergeMix(
					[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.375rem",
							fontSize: "0.8125rem",
							lineHeight: "1.3",
							color: "var(--ui-neutral-fg-muted)",
							"& > svg": { flex: "none", inlineSize: "0.9375rem", blockSize: "0.9375rem" },
						}),
					],
					mix,
				)}
			>
				{kind === "download" ? <DownloadIcon aria-hidden="true" /> : null}
				{kind === "ships" ? <TruckIcon aria-hidden="true" /> : null}
				{kind === "pickup" ? <StoreIcon aria-hidden="true" /> : null}
				<span>{children}</span>
			</span>
		);
	};
}
