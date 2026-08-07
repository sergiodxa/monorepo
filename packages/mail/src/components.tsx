/**
 * Layout kit for email bodies, built for the constraints mail clients impose:
 * table layout, inline styles, and no external stylesheet. It carries no product
 * branding — colors, logo, and footer content are props — so every app styles its
 * own mail without forking the components.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

/**
 * Font stack that resolves to a native UI face in every major mail client. No family
 * needs quoting, which keeps the inline style free of escaped character references.
 */
const FONT_FAMILY =
	"-apple-system, BlinkMacSystemFont, system-ui, Roboto, Helvetica, Arial, sans-serif";

/** Page color behind the content card. */
const PAGE_COLOR = "#f4f4f5";

/** Content card color. */
const SURFACE_COLOR = "#ffffff";

/** Body copy color. */
const TEXT_COLOR = "#18181b";

/** Color for de-emphasized copy such as footers. */
const MUTED_COLOR = "#71717a";

/** Fill color of a call-to-action button. */
const ACTION_COLOR = "#18181b";

/** Label color of a call-to-action button. */
const ACTION_LABEL_COLOR = "#ffffff";

/** Hairline color separating the footer from the body. */
const BORDER_COLOR = "#e4e4e7";

/** Content width in pixels, the widest that renders without scrolling on mobile. */
const CONTENT_WIDTH = 600;

/** Font size in pixels per heading level. */
const HEADING_SIZES: Record<1 | 2 | 3, number> = { 1: 24, 2: 20, 3: 16 };

/**
 * The dark counterpart of every color above, as the rules a client applies when the
 * reader is in dark mode.
 *
 * It exists because declaring a color scheme without shipping one is worse than
 * declaring nothing: Apple Mail reads `color-scheme: light dark` as a promise that the
 * message paints its own dark mode, so it stops remapping colors and leaves the copy
 * exactly as authored. On macOS it darkens the card anyway and the near-black body copy
 * on it becomes unreadable; on iOS it honours the promise in full and a dark inbox gets
 * a white email. Both are the same missing half.
 *
 * The rules are keyed on classes rather than on elements so they only reach what this
 * kit painted, and they are `!important` because the light values they replace are
 * inline styles, which is the only place a mail client is guaranteed to read them from.
 * Every element therefore carries both: the inline style is the light baseline and the
 * one clients that strip `<style>` keep, and the class is the dark override.
 *
 * A class is emitted only when the caller left that color to the kit — pass a color and
 * the element opts out of the dark rule for it, since the kit has no dark counterpart
 * for a color it has never seen.
 */
const DARK_RULES = [
	".mail-page{background-color:#09090b !important;}",
	".mail-surface{background-color:#18181b !important;}",
	".mail-text{color:#fafafa !important;}",
	".mail-muted{color:#a1a1aa !important;}",
	".mail-rule{border-color:#3f3f46 !important;}",
	".mail-action{background-color:#fafafa !important;}",
	".mail-action-label{color:#18181b !important;}",
].join("");

/**
 * Builds the document stylesheet: the kit's dark mode, then whatever the caller adds.
 *
 * The result is a text node, so the renderer escapes it — CSS written here or passed in
 * cannot use `>` or `&`, which rules out child combinators. Descendant and class
 * selectors are enough for everything a mail body contains.
 */
function stylesheet(extra: string | undefined): string {
	let dark = `@media (prefers-color-scheme:dark){${DARK_RULES}${extra ?? ""}}`;
	return `:root{color-scheme:light dark;}${dark}`;
}

export namespace Layout {
	/** Props accepted by {@link Layout}. */
	export interface Props {
		/** Body of the email, usually headings, text, and a button. */
		children?: RemixNode;
		/**
		 * Preheader shown beside the subject in inbox previews. It is hidden in the
		 * body and dropped from the plain-text part, so it never reads as duplicate copy.
		 */
		preview?: string;
		/** Logo rendered above the content; omitted means no logo. */
		logo?: { src: string; alt: string; width?: number };
		/** Document title, which some clients show when the email is opened in a browser. */
		title?: string;
		/** Language of the copy, so screen readers pronounce it correctly. */
		lang?: string;
		/** Page color behind the content card. */
		background?: string;
		/** Content card color. */
		surface?: string;
		/** Body copy color. */
		color?: string;
		/** Font stack applied to the whole document. */
		fontFamily?: string;
		/** Content width in pixels. */
		width?: number;
		/**
		 * CSS appended inside the kit's `prefers-color-scheme: dark` block, for the dark
		 * counterpart of colors the app's own components paint with. It is escaped as a
		 * text node, so it cannot contain `>` or `&`.
		 */
		darkStyles?: string;
	}
}

/**
 * Wraps an email body in a centered, fixed-width card inside a full HTML document.
 * Every rule is an inline style on a table, which is the only layout mail clients
 * agree on; the card and page colors are props so the kit stays unbranded.
 *
 * It also carries the one stylesheet the document has: the dark counterpart of the
 * kit's colors, which is why the layout is the only component that renders a `<head>`.
 * See {@link DARK_RULES} for why an email that declares a color scheme has to ship one.
 *
 * @example <Email.Layout preview="Your invite is ready"><Email.Text>Hi</Email.Text></Email.Layout>
 */
export function Layout(handle: Handle<Layout.Props>) {
	return () => {
		let {
			children,
			preview,
			logo,
			title,
			lang = "en",
			background,
			surface,
			color,
			fontFamily = FONT_FAMILY,
			width = CONTENT_WIDTH,
			darkStyles,
		} = handle.props;

		let page = background ?? PAGE_COLOR;
		let card = surface ?? SURFACE_COLOR;
		let ink = color ?? TEXT_COLOR;
		let pageClass = background === undefined ? "mail-page" : undefined;
		let cardClass = surface === undefined ? "mail-surface" : undefined;
		let inkClass = color === undefined ? "mail-text" : undefined;

		return (
			<html lang={lang}>
				<head>
					<meta charset="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<meta name="color-scheme" content="light dark" />
					<meta name="supported-color-schemes" content="light dark" />
					{title ? <title>{title}</title> : null}
					<style>{stylesheet(darkStyles)}</style>
				</head>
				<body
					class={pageClass}
					style={`margin:0;padding:0;width:100%;background-color:${page};color:${ink};font-family:${fontFamily};`}
				>
					{preview ? (
						<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;">
							{preview}
						</div>
					) : null}
					<table
						role="presentation"
						width="100%"
						cellPadding="0"
						cellSpacing="0"
						class={pageClass}
						style={`width:100%;background-color:${page};`}
					>
						<tbody>
							<tr>
								<td align="center" style="padding:24px 12px;">
									<table
										role="presentation"
										width={width}
										cellPadding="0"
										cellSpacing="0"
										class={cardClass}
										style={`width:100%;max-width:${width}px;background-color:${card};border-radius:8px;`}
									>
										<tbody>
											{logo ? (
												<tr>
													<td style="padding:24px 24px 0;">
														<img
															src={logo.src}
															alt={logo.alt}
															width={logo.width ?? 32}
															style="display:block;border:0;"
														/>
													</td>
												</tr>
											) : null}
											<tr>
												<td
													class={inkClass}
													style={`padding:24px;font-family:${fontFamily};color:${ink};font-size:16px;line-height:1.6;`}
												>
													{children}
												</td>
											</tr>
										</tbody>
									</table>
								</td>
							</tr>
						</tbody>
					</table>
				</body>
			</html>
		);
	};
}

export namespace Heading {
	/** Props accepted by {@link Heading}. */
	export interface Props {
		/** Heading copy. */
		children?: RemixNode;
		/** Outline level, which also picks the font size. */
		level?: 1 | 2 | 3;
		/** Heading color. */
		color?: string;
		/** Horizontal alignment of the copy. */
		align?: "left" | "center" | "right";
	}
}

/**
 * Renders a heading with the margin collapsed to zero on top, because mail clients
 * disagree on default heading margins and an inline reset is the only fix that holds.
 *
 * @example <Email.Heading level={2}>You have been invited</Email.Heading>
 */
export function Heading(handle: Handle<Heading.Props>) {
	return () => {
		let { children, level = 1, color, align = "left" } = handle.props;
		let className = color === undefined ? "mail-text" : undefined;
		let style = `margin:0 0 16px;padding:0;font-family:inherit;font-size:${HEADING_SIZES[level]}px;line-height:1.3;font-weight:600;color:${color ?? TEXT_COLOR};text-align:${align};`;

		if (level === 3)
			return (
				<h3 class={className} style={style}>
					{children}
				</h3>
			);
		if (level === 2)
			return (
				<h2 class={className} style={style}>
					{children}
				</h2>
			);
		return (
			<h1 class={className} style={style}>
				{children}
			</h1>
		);
	};
}

export namespace Text {
	/** Props accepted by {@link Text}. */
	export interface Props {
		/** Paragraph copy. */
		children?: RemixNode;
		/** Copy color; defaults to the body color, or the muted one when `muted` is set. */
		color?: string;
		/** Renders the paragraph in the de-emphasized color. */
		muted?: boolean;
		/** Font size in pixels. */
		size?: number;
		/** Horizontal alignment of the copy. */
		align?: "left" | "center" | "right";
	}
}

/**
 * Renders a paragraph of body copy with an explicit line height, since clients
 * that strip the document styles fall back to a cramped default otherwise.
 *
 * @example <Email.Text muted>This link expires in 24 hours.</Email.Text>
 */
export function Text(handle: Handle<Text.Props>) {
	return () => {
		let { children, muted = false, color, size = 16, align = "left" } = handle.props;
		let resolved = color ?? (muted ? MUTED_COLOR : TEXT_COLOR);
		let className = color === undefined ? (muted ? "mail-muted" : "mail-text") : undefined;

		return (
			<p
				class={className}
				style={`margin:0 0 16px;padding:0;font-family:inherit;font-size:${size}px;line-height:1.6;color:${resolved};text-align:${align};`}
			>
				{children}
			</p>
		);
	};
}

export namespace Button {
	/** Props accepted by {@link Button}. */
	export interface Props {
		/** Target of the call to action. */
		href: string;
		/** Button label. */
		children?: RemixNode;
		/** Fill color of the button. */
		background?: string;
		/** Label color of the button. */
		color?: string;
		/** Corner radius in pixels. */
		radius?: number;
	}
}

/**
 * Renders a call-to-action as a padded link inside a single-cell table, the only
 * button construction that keeps its fill in clients that drop CSS backgrounds on
 * anchors. The link is a real `<a href>`, so the plain-text part keeps its target.
 *
 * @example <Email.Button href={url}>Accept invite</Email.Button>
 */
export function Button(handle: Handle<Button.Props>) {
	return () => {
		let { href, children, background, color, radius = 6 } = handle.props;
		let fillClass = background === undefined ? "mail-action" : undefined;
		let labelClass = color === undefined ? "mail-action-label" : undefined;

		return (
			<table role="presentation" cellPadding="0" cellSpacing="0" style="margin:0 0 16px;">
				<tbody>
					<tr>
						<td
							align="center"
							class={fillClass}
							style={`background-color:${background ?? ACTION_COLOR};border-radius:${radius}px;`}
						>
							<a
								href={href}
								class={labelClass}
								style={`display:inline-block;padding:12px 20px;font-family:inherit;font-size:16px;line-height:1.2;font-weight:600;color:${color ?? ACTION_LABEL_COLOR};text-decoration:none;`}
							>
								{children}
							</a>
						</td>
					</tr>
				</tbody>
			</table>
		);
	};
}

export namespace Table {
	/** One row: what is being reported, and what it says. */
	export interface Row {
		/** Name of the thing reported, rendered in the de-emphasized color. */
		label: string;
		/** The value as the reader sees it, already formatted and translated. */
		value: RemixNode;
	}

	/** Props accepted by {@link Table}. */
	export interface Props {
		/** Rows in reading order. Rendering nothing for an empty list is deliberate. */
		rows: Row[];
		/** Color of the hairlines between rows. */
		borderColor?: string;
	}
}

/**
 * A set of facts as a two-column table: label on the left, value hard against the
 * right, hairlines between the rows.
 *
 * It exists because the alternative every email reaches for first — one paragraph per
 * fact reading `Label: value` — gives a reader no column to run their eye down, and
 * turns five short facts into five full-width lines of prose. A table is also the one
 * layout primitive mail clients agree on, so the alignment survives where a flex row
 * or a definition list would not.
 *
 * Values are nodes rather than strings so a row can hold a link without this component
 * knowing which rows are links.
 *
 * @example <Email.Table rows={[{ label: "Status", value: "Up" }]} />
 */
export function Table(handle: Handle<Table.Props>) {
	return () => {
		let { rows, borderColor } = handle.props;
		if (rows.length === 0) return null;

		let rule = borderColor === undefined ? " mail-rule" : "";

		return (
			<table
				role="presentation"
				width="100%"
				cellPadding="0"
				cellSpacing="0"
				style="width:100%;margin:0 0 16px;border-collapse:collapse;"
			>
				<tbody>
					{rows.map((row, index) => {
						// Hairlines go between rows, so the first one does without a top border and
						// the block sits flush against whatever precedes it.
						let border = index === 0 ? "none" : `1px solid ${borderColor ?? BORDER_COLOR}`;

						return (
							<tr key={row.label}>
								<td
									class={`mail-muted${rule}`}
									style={`padding:10px 12px 10px 0;border-top:${border};font-family:inherit;font-size:14px;line-height:1.4;color:${MUTED_COLOR};white-space:nowrap;vertical-align:top;`}
								>
									{row.label}
								</td>
								<td
									align="right"
									class={`mail-text${rule}`}
									style={`padding:10px 0;border-top:${border};font-family:inherit;font-size:14px;line-height:1.4;font-weight:600;color:${TEXT_COLOR};text-align:right;word-break:break-word;vertical-align:top;`}
								>
									{row.value}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		);
	};
}

export namespace Footer {
	/** Props accepted by {@link Footer}. */
	export interface Props {
		/** Footer content, such as an address, an unsubscribe link, or a legal note. */
		children?: RemixNode;
		/** Footer copy color. */
		color?: string;
		/** Color of the hairline above the footer. */
		borderColor?: string;
	}
}

/**
 * Closes an email with de-emphasized copy under a hairline. Content is entirely a
 * prop, so the kit never ships a company name, address, or unsubscribe wording.
 *
 * @example <Email.Footer>Sent because you were invited to a team.</Email.Footer>
 */
export function Footer(handle: Handle<Footer.Props>) {
	return () => {
		let { children, color, borderColor } = handle.props;

		return (
			<table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="width:100%;">
				<tbody>
					<tr>
						<td
							class={borderColor === undefined ? "mail-rule" : undefined}
							style={`padding:16px 0 0;border-top:1px solid ${borderColor ?? BORDER_COLOR};`}
						>
							<div
								class={color === undefined ? "mail-muted" : undefined}
								style={`font-family:inherit;font-size:12px;line-height:1.5;color:${color ?? MUTED_COLOR};`}
							>
								{children}
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		);
	};
}
