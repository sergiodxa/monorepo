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
import { clientEntry, Frame, ref } from "remix/component";

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
 */
export const IconDialog = clientEntry(
	import.meta.url,
	function IconDialog(handle: Handle<IconDialogProps>) {
		let shown: Shown | null = null;

		let listen = ref<HTMLDialogElement>((dialog, signal) => {
			document.addEventListener(
				"click",
				(event) => {
					if (event.defaultPrevented || event.button !== 0) return;
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
					let target = event.target instanceof Element ? event.target : null;
					let tile = target?.closest<HTMLAnchorElement>(
						`#${CSS.escape(handle.props.gridId)} a[${handle.props.frameAttribute}]`,
					);
					let frame = tile?.getAttribute(handle.props.frameAttribute);
					if (!tile || !frame) return;

					event.preventDefault();
					let search = styleSearch();
					shown = {
						name: tile.dataset.iconName ?? "",
						src: withSearch(frame, search),
						href: withSearch(tile.pathname, search),
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
					<Dialog.Header>
						<Dialog.Title id={titleId} mix={[font("mono")]}>
							{shown?.name ?? "Icon"}
						</Dialog.Title>
					</Dialog.Header>
					<div mix={[vstack({ gap: 4, align: "stretch" }), minBs("12rem"), p(0, 0, 2, 0)]}>
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
