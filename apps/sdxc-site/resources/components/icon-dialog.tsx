/**
 * Client island: the gallery's one detail dialog. A plain click on a tile opens it and mounts
 * a frame for that icon's detail, carrying the customization the address holds; until then
 * no frame exists, so the gallery requests nothing it was not asked for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { is, maxBs, maxIs, minBs, p } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Dialog, Spinner } from "@sdxc/ui";
import { dialogDismiss } from "@sdxc/ui/mixins";
import { clientEntry, Frame, prefetch, ref } from "remix/component";

import { ICON_STYLE_PARAMS } from "~/app/services/icon-style";

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type IconDialogProps = {
	/** The dialog's id, which its close button targets. */
	id: string;
	/** The grid whose tiles open the dialog. */
	gridId: string;
	/** The attribute a tile names its detail's fragment by. */
	frameAttribute: string;
};

/** The icon the dialog shows, and the addresses its detail and page load from. */
interface Shown {
	name: string;
	src: string;
	href: string;
}

/** How long a mouse or focus rests on a tile before its detail is fetched ahead. */
const INTENT_DELAY_MS = 100;

/** How long a detail fetched ahead stays usable, matching how long the browser entry keeps it. */
const PREFETCH_LIFETIME_MS = 30_000;

/** Whether the connection is one a fetch ahead suits, skipping data-saving and 2G connections. */
function allowsPrefetch(): boolean {
	let connection: unknown = Reflect.get(navigator, "connection");
	if (typeof connection !== "object" || connection === null) return true;
	if (Reflect.get(connection, "saveData") === true) return false;
	let effectiveType: unknown = Reflect.get(connection, "effectiveType");
	return effectiveType !== "slow-2g" && effectiveType !== "2g";
}

/** The customization the address holds, so the detail's snippets show what the grid draws. */
function styleSearch(): string {
	let current = new URLSearchParams(location.search);
	let style = new URLSearchParams();
	for (let name of Object.values(ICON_STYLE_PARAMS)) {
		let value = current.get(name);
		if (value !== null) style.set(name, value);
	}
	return style.toString();
}

/** `path` with `search` appended, when there is one. */
function withSearch(path: string, search: string): string {
	return search === "" ? path : `${path}?${search}`;
}

/**
 * Renders the dialog and opens it for a tile's plain click. A click with a modifier, or a
 * middle click, still opens the icon's page the way the link says, in a new tab or window.
 * A press on the backdrop closes it in every engine, including those without `closedby`.
 * Resting the mouse or focus on a tile, or pressing it, fetches its detail ahead.
 */
export const IconDialog = clientEntry(
	import.meta.url,
	function IconDialog(handle: Handle<IconDialogProps>) {
		let shown: Shown | null = null;
		/** When each detail was last fetched ahead, so resting on a tile again reuses that fetch. */
		let fetchedAt = new Map<string, number>();
		let intent: ReturnType<typeof setTimeout> | undefined;

		/** The tile an event happened on, when it happened on one of the grid's tiles. */
		function tileOf(event: Event): HTMLAnchorElement | null {
			let target = event.target instanceof Element ? event.target : null;
			return (
				target?.closest<HTMLAnchorElement>(
					`#${CSS.escape(handle.props.gridId)} a[${handle.props.frameAttribute}]`,
				) ?? null
			);
		}

		/** The detail's address for `tile`, carrying the customization the address holds. */
		function detailSrc(tile: HTMLAnchorElement): string | null {
			let frame = tile.getAttribute(handle.props.frameAttribute);
			return frame ? withSearch(frame, styleSearch()) : null;
		}

		/**
		 * Fetches `tile`'s detail ahead, so the dialog opens with its content rather than growing
		 * into it. The browser entry keeps the response for the frame to use once.
		 */
		function fetchAhead(tile: HTMLAnchorElement): void {
			clearTimeout(intent);
			let src = detailSrc(tile);
			if (src === null || !allowsPrefetch()) return;
			let at = fetchedAt.get(src);
			if (at !== undefined && Date.now() - at < PREFETCH_LIFETIME_MS) return;
			fetchedAt.set(src, Date.now());
			prefetch(src);
		}

		/** Starts the wait a resting mouse or focus has to outlast before the detail is fetched. */
		function rest(event: Event): void {
			let tile = tileOf(event);
			if (tile === null) return;
			clearTimeout(intent);
			intent = setTimeout(() => fetchAhead(tile), INTENT_DELAY_MS);
		}

		/** Cancels the wait when the mouse or focus leaves the tile it rested on. */
		function leave(event: Event): void {
			let tile = tileOf(event);
			let next =
				event instanceof FocusEvent || event instanceof MouseEvent ? event.relatedTarget : null;
			if (tile !== null && next instanceof Node && tile.contains(next)) return;
			clearTimeout(intent);
		}

		let listen = ref<HTMLDialogElement>((dialog, signal) => {
			signal.addEventListener("abort", () => clearTimeout(intent), { once: true });
			document.addEventListener(
				"pointerover",
				(event) => {
					if (event.pointerType === "mouse") rest(event);
				},
				{ signal },
			);
			document.addEventListener("focusin", rest, { signal });
			document.addEventListener("pointerout", leave, { signal });
			document.addEventListener("focusout", leave, { signal });
			document.addEventListener(
				"pointerdown",
				(event) => {
					if (!event.isPrimary || event.button !== 0) return;
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
					let tile = tileOf(event);
					if (tile) fetchAhead(tile);
				},
				{ passive: true, signal },
			);
			document.addEventListener(
				"click",
				(event) => {
					if (event.defaultPrevented || event.button !== 0) return;
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
					let tile = tileOf(event);
					let src = tile ? detailSrc(tile) : null;
					if (!tile || !src) return;

					event.preventDefault();
					shown = {
						name: tile.dataset.iconName ?? "",
						src,
						href: withSearch(tile.pathname, styleSearch()),
					};
					void handle.update();
					if (!dialog.open) dialog.showModal();
				},
				{ signal },
			);
		});

		return () => {
			let { id } = handle.props;
			let titleId = `${id}-title`;
			return (
				<Dialog
					id={id}
					aria-labelledby={titleId}
					closedby="any"
					mix={[
						listen,
						is("min(44rem, 100% - 2rem)"),
						maxIs("none"),
						maxBs("calc(100dvh - 2rem)"),
						raw({ overflowY: "auto" }),
					]}
				>
					<span hidden mix={[dialogDismiss()]} />
					<Dialog.Header>
						<Dialog.Title id={titleId} mix={[font("mono")]}>
							{shown?.name ?? "Icon"}
						</Dialog.Title>
					</Dialog.Header>
					<div
						mix={[
							vstack({ gap: 4, align: "stretch" }),
							minBs("12rem"),
							raw({ flexShrink: 0 }),
							p(0, 0, 2, 0),
						]}
					>
						{shown ? (
							<Frame
								key={shown.src}
								src={shown.src}
								fallback={
									<div
										mix={[vstack({ gap: 2, align: "center", justify: "center" }), minBs("12rem")]}
									>
										<Spinner aria-label="Loading the icon" />
									</div>
								}
							/>
						) : null}
						{shown ? (
							<a href={shown.href} mix={[text("sm"), fg("brand")]}>
								Open the {shown.name} page
							</a>
						) : null}
					</div>
					<Dialog.Close commandfor={id} aria-label="Close" />
				</Dialog>
			);
		};
	},
);

export default IconDialog;
