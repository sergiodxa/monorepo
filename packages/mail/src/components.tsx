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
 * The dark counterpart of every color above. A declared color scheme with no
 * dark rules leaves Apple Mail's promise half kept, so these `!important` classes
 * override every inline light value for colors the caller left to the kit.
 */
const DARK_RULES = [
	".mail-page{background-color:#09090b !important;}",
	".mail-surface{background-color:#18181b !important;}",
	".mail-text{color:#fafafa !important;}",
	".mail-muted{color:#a1a1aa !important;}",
	".mail-rule{border-color:#3f3f46 !important;}",
	".mail-action{background-color:#fafafa !important;}",
	".mail-action-label{color:#18181b !important;}",
	".mail-code{background-color:#27272a !important;color:#fafafa !important;}",
	".mail-tok-comment{color:#8b949e !important;}",
	".mail-tok-keyword{color:#ff7b72 !important;}",
	".mail-tok-string{color:#a5d6ff !important;}",
	".mail-tok-number{color:#79c0ff !important;}",
	".mail-tok-function{color:#d2a8ff !important;}",
	".mail-tok-punctuation{color:#c9d1d9 !important;}",
	".mail-tok-inserted{color:#7ee787 !important;}",
	".mail-tok-deleted{color:#ffa198 !important;}",
].join("");

/**
 * Builds the document stylesheet: the kit's dark mode, then whatever the caller
 * adds. The result is a text node, so the renderer escapes it, ruling out `>` and
 * `&` and any child combinator; descendant and class selectors cover everything.
 */
function stylesheet(fonts: Font[], extra: string | undefined): string {
	let faces = fonts.map(fontFace).join("");
	let dark = `@media (prefers-color-scheme:dark){${DARK_RULES}${extra ?? ""}}`;
	return `:root{color-scheme:light dark;}${faces}${dark}`;
}

/**
 * A web font to load, and what to use instead everywhere it does not arrive. It
 * is a prop of {@link Layout} instead of its own component because `@font-face`
 * only works inside `<head>`, which only the layout renders in the document.
 */
export interface Font {
	/** Family name, as the `@font-face` rule declares it and the copy asks for it. */
	family: string;
	/**
	 * What to fall back to, as a CSS font list. It is required because most readers get
	 * it: `@font-face` is unsupported in Gmail, Yahoo, and Outlook on Windows, which is
	 * most of any list, so this is the font the email is actually set in.
	 */
	fallback: string;
	/** Where to fetch the font, omitted for a family the reader is assumed to have. */
	src?: {
		/** Absolute URL of the font file. */
		url: string;
		/** Format at that URL, which the rule has to name for the client to accept it. */
		format: "woff" | "woff2" | "truetype" | "opentype" | "embedded-opentype" | "svg";
	};
	/** Weight this file provides. */
	weight?: number;
	/** Style this file provides. */
	style?: "normal" | "italic";
}

/**
 * One `@font-face` rule. `mso-font-alt` is Outlook's own fallback declaration:
 * Word ignores the `@font-face` rule but reads that property, keeping an
 * unavailable family on the stack's chosen fallback instead of Times New Roman.
 */
function fontFace(font: Font): string {
	let { family, fallback, src, weight = 400, style = "normal" } = font;
	let source = src ? `src:url(${src.url}) format('${src.format}');` : "";
	let alt = fallback.split(",")[0]?.trim() ?? "sans-serif";
	return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};mso-font-alt:'${alt}';${source}}`;
}

/**
 * The font stack a set of web fonts asks for: the first family, then its
 * fallbacks, left unquoted because a `style` attribute escapes a quote to
 * `&#39;`, naming a family no font has — CSS has allowed bare names since 2.1.
 */
function fontStack(fonts: Font[]): string | undefined {
	let first = fonts[0];
	if (!first) return undefined;
	return `${first.family}, ${first.fallback}`;
}

/** How much of an inbox snippet a client will show before it stops reading. */
const PREVIEW_LENGTH = 200;

/**
 * Characters that occupy a snippet without printing: no-break space, the zero-width
 * non-joiner, space, joiner, the two directional marks, and the byte-order mark. Seven
 * of them, cycled, so no client's duplicate-run collapsing shortens the padding.
 */
const BLANKS = " ‌​‍‎‏﻿";

/**
 * Pads a preheader to the length a client reads, with characters that render as
 * nothing, so the inbox snippet stops at the block instead of spilling into the
 * body — an unpadded six-word preheader reads `... RECOVERED Monitor Book Landing`.
 */
function previewPadding(preview: string): string {
	let missing = PREVIEW_LENGTH - preview.length;
	if (missing <= 0) return "";
	return BLANKS.repeat(Math.ceil(missing / BLANKS.length)).slice(0, missing);
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
		/**
		 * Font stack applied to the whole document. Omitted with `fonts` set, the stack is
		 * built from the first of those; omitted with neither, the kit's own stack is used.
		 */
		fontFamily?: string;
		/** Web fonts to declare, in preference order. */
		fonts?: Font[];
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
 * Wraps an email body in a centered, fixed-width card of inline-styled tables,
 * with colors as props so the kit stays unbranded, and renders the document's
 * only stylesheet — the dark counterpart of its colors; see {@link DARK_RULES}.
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
			fontFamily,
			fonts = [],
			width = CONTENT_WIDTH,
			darkStyles,
		} = handle.props;

		let family = fontFamily ?? fontStack(fonts) ?? FONT_FAMILY;
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
					<meta name="x-apple-disable-message-reformatting" />
					{title ? <title>{title}</title> : null}
					<style>{stylesheet(fonts, darkStyles)}</style>
				</head>
				<body
					class={pageClass}
					style={`margin:0;padding:0;width:100%;background-color:${page};color:${ink};font-family:${family};`}
				>
					{preview ? (
						<div
							data-skip-in-text
							style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;"
						>
							{preview}
							{previewPadding(preview)}
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
								<td
									align="center"
									class={inkClass}
									style={`padding:24px 12px;color:${ink};font-family:${family};`}
								>
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
													style={`padding:24px;font-family:${family};color:${ink};font-size:16px;line-height:1.6;`}
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
 * Renders a call-to-action as a link inside a single-cell table so the fill
 * survives in clients that drop CSS backgrounds on anchors, with the padding
 * on the cell since Word supports neither inline-block nor padding on an anchor.
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
							style={`padding:12px 20px;background-color:${background ?? ACTION_COLOR};border-radius:${radius}px;`}
						>
							<a
								href={href}
								class={labelClass}
								style={`display:inline-block;font-family:inherit;font-size:16px;line-height:1.2;font-weight:600;color:${color ?? ACTION_LABEL_COLOR};text-decoration:none;`}
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
 * A set of facts as a two-column table: label on the left, value against the
 * right, with hairlines between rows — a scannable column beats one paragraph
 * per fact, and stays a layout every mail client renders alike.
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

export namespace Section {
	/** Props accepted by {@link Section}. */
	export interface Props {
		/** Content of the section. */
		children?: RemixNode;
		/** Padding shorthand applied inside the section, in CSS syntax. */
		padding?: string;
		/** Fill behind the section; omitted means it inherits whatever it sits on. */
		background?: string;
		/** Horizontal alignment of the content. */
		align?: "left" | "center" | "right";
	}
}

/**
 * A full-width band of content, as a single-cell table. Padding sits on the
 * cell and the fill on the table — the split Outlook needs, since it drops
 * padding declared directly on a `<table>`, so the fill paints the whole band.
 *
 * @example <Email.Section padding="24px 0"><Email.Text>Grouped copy</Email.Text></Email.Section>
 */
export function Section(handle: Handle<Section.Props>) {
	return () => {
		let { children, padding, background, align = "left" } = handle.props;
		let fill = background ? `background-color:${background};` : "";

		return (
			<table
				role="presentation"
				width="100%"
				cellPadding="0"
				cellSpacing="0"
				style={`width:100%;${fill}`}
			>
				<tbody>
					<tr>
						<td
							align={align}
							style={`${padding ? `padding:${padding};` : ""}font-family:inherit;text-align:${align};`}
						>
							{children}
						</td>
					</tr>
				</tbody>
			</table>
		);
	};
}

export namespace Row {
	/** Props accepted by {@link Row}. */
	export interface Props {
		/** The row's cells, which should be {@link Column} elements. */
		children?: RemixNode;
		/** Space below the row in pixels. */
		gap?: number;
	}
}

/**
 * Puts its columns side by side as one table row, the one horizontal
 * arrangement no client gets wrong, since Outlook supports neither flex nor
 * grid; width stays fixed, so keep the column count low for phones.
 *
 * @example <Email.Row><Email.Column width="50%">Left</Email.Column><Email.Column>Right</Email.Column></Email.Row>
 */
export function Row(handle: Handle<Row.Props>) {
	return () => {
		let { children, gap = 16 } = handle.props;

		return (
			<table
				role="presentation"
				width="100%"
				cellPadding="0"
				cellSpacing="0"
				style={`width:100%;margin:0 0 ${gap}px;border-collapse:collapse;`}
			>
				<tbody>
					<tr>{children}</tr>
				</tbody>
			</table>
		);
	};
}

export namespace Column {
	/** Props accepted by {@link Column}. */
	export interface Props {
		/** Content of the cell. */
		children?: RemixNode;
		/**
		 * Width as a CSS length or percentage; a bare number is read as pixels. Omitted
		 * lets the table divide the space.
		 */
		width?: string | number;
		/** Horizontal alignment of the content. */
		align?: "left" | "center" | "right";
		/** Vertical alignment of the content against the tallest cell in the row. */
		valign?: "top" | "middle" | "bottom";
		/** Padding shorthand inside the cell, in CSS syntax. */
		padding?: string;
	}
}

/**
 * One cell of a {@link Row}.
 *
 * The width is set as both the `width` attribute and a style, because Outlook reads
 * the attribute and ignores the style while everything newer does the reverse.
 *
 * @example <Email.Column width="120" valign="top"><Email.Img src={logo} alt="Acme" /></Email.Column>
 */
export function Column(handle: Handle<Column.Props>) {
	return () => {
		let { children, width, align = "left", valign = "top", padding } = handle.props;
		let length = typeof width === "number" ? `${width}px` : width;

		return (
			<td
				align={align}
				valign={valign}
				width={width}
				style={`${length ? `width:${length};` : ""}${padding ? `padding:${padding};` : ""}font-family:inherit;text-align:${align};vertical-align:${valign};`}
			>
				{children}
			</td>
		);
	};
}

export namespace Link {
	/** Props accepted by {@link Link}. */
	export interface Props {
		/** Where the link goes. */
		href: string;
		/** Link text. */
		children?: RemixNode;
		/** Link color; omitted inherits the surrounding copy, so dark mode carries it. */
		color?: string;
		/** Whether the link is underlined. */
		underline?: boolean;
	}
}

/**
 * An inline link, opening in a new tab, whose color is inherited so it always
 * matches the copy around it and never needs its own entry in the dark rules;
 * the underline alone marks it as a link, as a mail reader expects.
 *
 * @example <Email.Link href={url}>the settings page</Email.Link>
 */
export function Link(handle: Handle<Link.Props>) {
	return () => {
		let { href, children, color, underline = true } = handle.props;
		let decoration = underline ? "underline" : "none";

		return (
			<a
				href={href}
				target="_blank"
				rel="noopener noreferrer"
				style={`color:${color ?? "inherit"};text-decoration:${decoration};font-family:inherit;`}
			>
				{children}
			</a>
		);
	};
}

export namespace Img {
	/** Props accepted by {@link Img}. */
	export interface Props {
		/** Absolute URL of the image; a relative one resolves against nothing in an inbox. */
		src: string;
		/**
		 * What the image says, for the reader who never sees it. Required since most
		 * readers are that reader — every major client blocks remote images until
		 * asked — so pass an empty string for an image that carries no meaning.
		 */
		alt: string;
		/** Width in pixels. */
		width?: number;
		/** Height in pixels; omitted lets the image keep its ratio. */
		height?: number;
		/** Corner radius in pixels. */
		radius?: number;
		/** Space below the image in pixels. */
		gap?: number;
	}
}

/**
 * An image with the four resets an inbox needs: `display:block` so no line-height gap
 * opens underneath it, and a cleared border, outline and underline so a client that
 * inherits link styling leaves it unframed.
 *
 * @example <Email.Img src="https://acme.com/logo.png" alt="Acme" width={120} />
 */
export function Img(handle: Handle<Img.Props>) {
	return () => {
		let { src, alt, width, height, radius, gap } = handle.props;

		return (
			<img
				src={src}
				alt={alt}
				width={width}
				height={height}
				style={`display:block;border:0;outline:none;text-decoration:none;max-width:100%;${radius ? `border-radius:${radius}px;` : ""}${gap ? `margin:0 0 ${gap}px;` : ""}`}
			/>
		);
	};
}

export namespace Hr {
	/** Props accepted by {@link Hr}. */
	export interface Props {
		/** Rule color. */
		color?: string;
		/** Space above and below the rule in pixels. */
		gap?: number;
	}
}

/**
 * A horizontal rule drawn as a top border, since clients disagree about what an
 * `<hr>` looks like by default and several render the native one as an inset
 * two-tone groove.
 *
 * @example <Email.Hr />
 */
export function Hr(handle: Handle<Hr.Props>) {
	return () => {
		let { color, gap = 24 } = handle.props;

		return (
			<hr
				class={color === undefined ? "mail-rule" : undefined}
				style={`width:100%;margin:${gap}px 0;padding:0;border:none;border-top:1px solid ${color ?? BORDER_COLOR};`}
			/>
		);
	};
}

/** Monospace stack, chosen so no family needs quoting inside a `style` attribute. */
export const MONO_FAMILY =
	"ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace";

/** Fill behind code, light enough to sit inside the card without reading as a block. */
export const CODE_COLOR = "#f4f4f5";

export namespace CodeInline {
	/** Props accepted by {@link CodeInline}. */
	export interface Props {
		/** The code, as text. */
		children?: RemixNode;
	}
}

/**
 * A short run of code inside a sentence.
 *
 * The size is `0.9em` rather than a pixel value so it tracks whatever it is set inside —
 * a heading, body copy, a footer — instead of turning into body-sized code in a caption.
 *
 * @example <Email.Text>Set <Email.CodeInline>DEBUG=1</Email.CodeInline> and retry.</Email.Text>
 */
export function CodeInline(handle: Handle<CodeInline.Props>) {
	return () => (
		<code
			class="mail-code"
			style={`font-family:${MONO_FAMILY};font-size:0.9em;padding:2px 5px;border-radius:4px;background-color:${CODE_COLOR};color:${TEXT_COLOR};`}
		>
			{handle.props.children}
		</code>
	);
}
