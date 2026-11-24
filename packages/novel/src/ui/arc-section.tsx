/**
 * The arc grouping the library screens share: a section per arc headed by its title, locked until
 * the reader reaches one of its chapters, and a heading whose level follows the depth it sits at,
 * so a story with arcs nests its chapter and scene headings one level deeper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { css } from "remix/component";

import type { ArcInfo } from "../declarations.js";

import { Message } from "./message.js";

/** Props of {@link ArcSection}. */
export interface ArcSectionProps {
	arc: ArcInfo;
	reached: boolean;
	lockedLabel: string;
	children?: RemixNode;
}

/**
 * One arc of a library screen: its title as an `h3`, or the locked label until the reader reaches
 * one of its chapters, above the chapters it groups.
 */
export function ArcSection(handle: Handle<ArcSectionProps>) {
	return () => {
		let { arc, reached, lockedLabel, children } = handle.props;
		return (
			<section
				data-arc={arc.name}
				data-reached={String(reached)}
				mix={css({ display: "grid", gap: "0.75rem" })}
			>
				{arc.title === undefined ? null : (
					<h3 mix={css({ margin: 0 })}>
						{reached ? <Message i18nKey={arc.title} /> : lockedLabel}
					</h3>
				)}
				{children}
			</section>
		);
	};
}

/** Props of {@link LibraryHeading}. */
export interface LibraryHeadingProps {
	level: 3 | 4 | 5;
	/** Draws the heading at reduced opacity, as a scene's title under its chapter's. */
	faded?: boolean;
	children?: RemixNode;
}

/** A library screen's heading at the level its depth asks for. */
export function LibraryHeading(handle: Handle<LibraryHeadingProps>) {
	return () => {
		let { level, faded, children } = handle.props;
		let style = css({ margin: 0, opacity: faded === true ? 0.8 : 1 });
		if (level === 3) return <h3 mix={style}>{children}</h3>;
		if (level === 4) return <h4 mix={style}>{children}</h4>;
		return <h5 mix={style}>{children}</h5>;
	};
}
