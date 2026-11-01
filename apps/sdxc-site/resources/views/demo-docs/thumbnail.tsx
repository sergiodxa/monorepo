/**
 * A docs demo's gallery miniature: its own mark and sidebar sections beside a page with a
 * heading, prose lines and a code block, drawn in the site's palettes, faces and radii, so
 * each docs card shows the site's art direction from one shared scene.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import DemoMiniature from "~/resources/components/demo-miniature";

namespace DocsThumbnail {
	export interface Props {
		site: DemoDocsSite;
	}
}

/** How far each prose line of the page runs, as a share of the column. */
const PROSE = [100, 92, 97, 64];

/** Renders the site's shell in miniature, its first sidebar entry marked current. */
export default function DocsThumbnail(handle: Handle<DocsThumbnail.Props>) {
	return () => {
		let { site } = handle.props;
		let sections = site.tree.sections.slice(0, 2);
		let headingFont = "var(--demo-docs-heading-font, var(--ui-font-sans))";

		return (
			<DemoMiniature
				brand={site.theme.brand}
				neutral={site.theme.neutral}
				tokens={site.theme.tokens}
			>
				<div
					mix={[
						raw({
							position: "absolute",
							inset: "0",
							display: "grid",
							gridTemplateColumns: "minmax(6rem, 34%) 1fr",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "0.375rem",
								padding: "0.875rem 0.75rem",
								borderInlineEnd: "1px solid var(--ui-neutral-border)",
								overflow: "hidden",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.375rem",
									marginBlockEnd: "0.25rem",
									fontFamily: headingFont,
									fontWeight: "var(--demo-docs-heading-weight, 600)",
								}),
							]}
						>
							{site.mark()}
							{site.name}
						</span>
						{sections.flatMap((section, sectionIndex) => [
							<span
								key={section.title}
								mix={[raw({ color: "var(--ui-neutral-fg-muted)", whiteSpace: "nowrap" })]}
							>
								{section.title}
							</span>,
							...section.items.slice(0, 2).map((item, itemIndex) => (
								<span
									key={item.href}
									mix={[
										raw({
											whiteSpace: "nowrap",
											overflow: "hidden",
											textOverflow: "ellipsis",
											paddingInline: "0.375rem",
											borderRadius: "var(--ui-radius-md, 0.375rem)",
										}),
										sectionIndex === 0 && itemIndex === 0
											? raw({
													backgroundColor: "var(--ui-brand-bg-tint)",
													color: "var(--ui-brand-fg)",
													fontWeight: "600",
												})
											: [],
									]}
								>
									{item.title}
								</span>
							)),
						])}
					</div>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "0.5rem",
								padding: "1rem",
								overflow: "hidden",
							}),
						]}
					>
						<span
							mix={[
								raw({
									fontFamily: headingFont,
									fontWeight: "var(--demo-docs-heading-weight, 600)",
									fontSize: "0.9375rem",
									whiteSpace: "nowrap",
								}),
							]}
						>
							{sections[0]?.items[0]?.title}
						</span>
						{PROSE.map((width, index) => (
							<span
								key={index}
								mix={[
									raw({
										blockSize: "0.3125rem",
										inlineSize: `${width}%`,
										borderRadius: "2px",
										backgroundColor: "var(--ui-neutral-border)",
									}),
								]}
							/>
						))}
						<div
							mix={[
								raw({
									display: "flex",
									flexDirection: "column",
									gap: "0.3125rem",
									marginBlockStart: "0.25rem",
									padding: "0.625rem",
									borderRadius: "var(--ui-radius-lg, 0.5rem)",
									backgroundColor: "var(--ui-color-neutral-900)",
								}),
							]}
						>
							{[58, 82, 40].map((width, index) => (
								<span
									key={index}
									mix={[
										raw({
											blockSize: "0.3125rem",
											inlineSize: `${width}%`,
											borderRadius: "2px",
											backgroundColor:
												index === 1
													? "var(--ui-color-brand-400)"
													: "color-mix(in oklch, var(--ui-color-neutral-50) 45%, transparent)",
										}),
									]}
								/>
							))}
						</div>
					</div>
				</div>
			</DemoMiniature>
		);
	};
}
