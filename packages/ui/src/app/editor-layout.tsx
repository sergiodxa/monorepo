/**
 * The frame of a document editor: a sticky action bar (back, title, save status, Preview,
 * the primary action), a main column held to a ~680px writing measure, and a properties
 * sidebar that becomes a full-screen sheet behind a "Settings" button on a narrow screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ArrowLeftIcon, SlidersHorizontalIcon, XIcon } from "@sdxc/icons";
import { bg, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { container, hstack, inlineFlex, items, justify, shrink, vstack } from "@sdxc/u/layout";
import { bs, is, m, minIs, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text, truncate, weight } from "@sdxc/u/typography";

import { Button } from "../components/button.js";

/** Container the layout measures, so the sheet follows the editor's own width. */
const LAYOUT_CONTAINER = "ui-editor-layout";

/** Width at which the sidebar sits beside the writing column. */
const WIDE = `@container ${LAYOUT_CONTAINER} (min-width: 56rem)`;

/** Width below which the sidebar is a sheet. */
const NARROW = `@container ${LAYOUT_CONTAINER} (max-width: 55.999rem)`;

/**
 * Prop types for {@link EditorLayout}.
 */
export namespace EditorLayout {
	/** Every string the layout shows or announces. */
	export interface Labels {
		/** The button that opens the sidebar on a narrow screen, such as "Settings". */
		settings: string;
		/** The sheet's close button, such as "Close settings". */
		closeSettings: string;
		/** The sidebar's landmark name and sheet heading, such as "Post settings". */
		sidebar: string;
	}

	/** Props accepted by {@link EditorLayout}. */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Where the back arrow leads, and its accessible name, such as "Posts". */
		back?: { href: string; label: string };
		/** The document's name in the bar, such as its title and type. */
		title: RemixNode;
		/** The persistence signal, usually a `SaveStatus`. */
		status?: RemixNode;
		/** A Preview link or button, before the primary action. */
		preview?: RemixNode;
		/** The publication action, such as a Publish button whose label carries its state. */
		primary?: RemixNode;
		/** The document's properties: status, slug, author, tags. */
		sidebar?: RemixNode;
		labels: Labels;
	}
}

/**
 * Renders the bar, the writing column and the sidebar. The sidebar is one `popover`
 * element: beside the column on a wide container and a full-screen sheet when narrow,
 * so the sheet opens and closes with no script.
 *
 * @param handle Runtime handle carrying the layout's props.
 * @returns The render function producing the layout's markup.
 * @example
 * <EditorLayout
 * 	back={{ href: "/posts", label: "Posts" }}
 * 	title="Designing a calmer editor"
 * 	status={<SaveStatus id="post-status" labels={…} />}
 * 	preview={<LinkButton href={previewUrl} variant="ghost" size="sm">Preview</LinkButton>}
 * 	primary={<Button size="sm" disabled={!hasChanges}>Publish</Button>}
 * 	sidebar={<PropertyList>…</PropertyList>}
 * 	labels={{ settings: "Settings", closeSettings: "Close settings", sidebar: "Post settings" }}
 * >
 * 	<PostBody />
 * </EditorLayout>
 */
export function EditorLayout(handle: Handle<EditorLayout.Props>) {
	return () => {
		let { back, title, status, preview, primary, sidebar, labels, children, mix, ...rest } =
			handle.props;
		let sidebarId = `${handle.id}-sidebar`;
		let sheetTitleId = `${handle.id}-sidebar-title`;

		return (
			<div
				{...rest}
				data-slot="editor-layout"
				mix={mergeMix([is("100%"), minIs(0), container(LAYOUT_CONTAINER)], mix)}
			>
				<header
					data-slot="editor-bar"
					mix={[
						hstack({ gap: 2, align: "center" }),
						raw({
							position: "sticky",
							insetBlockStart: "var(--ui-app-sticky-top, 0px)",
							zIndex: 10,
							flexWrap: "wrap",
							minBlockSize: "var(--ui-app-header-height, 3.5rem)",
						}),
						p(2, 3),
						bg("neutral.surface"),
						borderEdge("block-end", { color: "neutral", width: 1, style: "solid" }),
					]}
				>
					{back ? (
						<a
							href={back.href}
							aria-label={back.label}
							title={back.label}
							data-slot="editor-back"
							mix={[
								inlineFlex(),
								items("center"),
								justify("center"),
								shrink(0),
								is(8),
								bs(8),
								rounded("md"),
								fg("neutral"),
								hover([bg("neutral.bg-tint"), fg("neutral.emphasis")]),
								when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
							]}
						>
							<ArrowLeftIcon size={16} aria-hidden="true" />
						</a>
					) : null}
					<h1
						data-slot="editor-title"
						mix={[
							m(0),
							minIs(0),
							raw({ flex: "1 1 8rem" }),
							truncate(),
							text("sm"),
							weight("medium"),
							fg("neutral.emphasis"),
						]}
					>
						{title}
					</h1>
					<div
						mix={[
							hstack({ gap: 2, align: "center" }),
							raw({ flexWrap: "wrap", marginInlineStart: "auto" }),
						]}
					>
						{status}
						{sidebar ? (
							<Button
								type="button"
								popovertarget={sidebarId}
								popovertargetaction="show"
								variant="ghost"
								color="neutral"
								size="sm"
								data-slot="editor-settings-toggle"
								mix={[raw({ [WIDE]: { display: "none" } })]}
							>
								<SlidersHorizontalIcon size={16} aria-hidden="true" />
								{labels.settings}
							</Button>
						) : null}
						{preview}
						{primary}
					</div>
				</header>

				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							[WIDE]: {
								gridTemplateColumns: sidebar
									? "minmax(0, 1fr) var(--ui-editor-sidebar-width, 18rem)"
									: "minmax(0, 1fr)",
							},
						}),
					]}
				>
					<div data-slot="editor-main" mix={[minIs(0), p(6, 4)]}>
						<div
							mix={[
								raw({
									maxInlineSize: "var(--ui-editor-measure, 42.5rem)",
									marginInline: "auto",
								}),
							]}
						>
							{children}
						</div>
					</div>

					{sidebar ? (
						<aside
							id={sidebarId}
							popover="auto"
							aria-labelledby={sheetTitleId}
							data-slot="editor-sidebar"
							mix={[
								minIs(0),
								bg("neutral.surface"),
								fg("neutral.emphasis"),
								raw({
									[NARROW]: {
										inset: 0,
										inlineSize: "100%",
										blockSize: "100%",
										maxInlineSize: "none",
										maxBlockSize: "none",
										margin: 0,
										padding: 0,
										border: 0,
										overflowY: "auto",
										overscrollBehavior: "contain",
									},
									[WIDE]: {
										display: "block",
										position: "sticky",
										insetBlockStart:
											"calc(var(--ui-app-sticky-top, 0px) + var(--ui-app-header-height, 3.5rem))",
										alignSelf: "start",
										inset: "auto",
										inlineSize: "auto",
										blockSize: "auto",
										maxBlockSize:
											"calc(100dvh - var(--ui-app-sticky-top, 0px) - var(--ui-app-header-height, 3.5rem))",
										overflowY: "auto",
										margin: 0,
										padding: 0,
										border: 0,
										borderInlineStart: "1px solid var(--ui-neutral-border)",
										color: "inherit",
										background: "none",
									},
								}),
							]}
						>
							<div
								data-slot="editor-sidebar-header"
								mix={[
									hstack({ gap: 2, align: "center", justify: "between" }),
									p(2, 2, 2, 4),
									borderEdge("block-end", { color: "neutral", width: 1, style: "solid" }),
									raw({ [WIDE]: { display: "none" } }),
								]}
							>
								<p id={sheetTitleId} mix={[m(0), text("sm"), weight("semibold")]}>
									{labels.sidebar}
								</p>
								<Button
									type="button"
									popovertarget={sidebarId}
									popovertargetaction="hide"
									variant="ghost"
									color="neutral"
									size="sm"
									aria-label={labels.closeSettings}
								>
									<XIcon size={16} aria-hidden="true" />
								</Button>
							</div>
							<div mix={[vstack({ gap: 4, align: "stretch" }), p(4)]}>{sidebar}</div>
						</aside>
					) : null}
				</div>
			</div>
		);
	};
}
