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
	}
}

/**
 * Wraps an email body in a centered, fixed-width card inside a full HTML document.
 * Every rule is an inline style on a table, which is the only layout mail clients
 * agree on; the card and page colors are props so the kit stays unbranded.
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
			background = PAGE_COLOR,
			surface = SURFACE_COLOR,
			color = TEXT_COLOR,
			fontFamily = FONT_FAMILY,
			width = CONTENT_WIDTH,
		} = handle.props;

		return (
			<html lang={lang}>
				<head>
					<meta charset="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<meta name="color-scheme" content="light dark" />
					{title ? <title>{title}</title> : null}
				</head>
				<body
					style={`margin:0;padding:0;width:100%;background-color:${background};color:${color};font-family:${fontFamily};`}
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
						style={`width:100%;background-color:${background};`}
					>
						<tbody>
							<tr>
								<td align="center" style="padding:24px 12px;">
									<table
										role="presentation"
										width={width}
										cellPadding="0"
										cellSpacing="0"
										style={`width:100%;max-width:${width}px;background-color:${surface};border-radius:8px;`}
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
													style={`padding:24px;font-family:${fontFamily};color:${color};font-size:16px;line-height:1.6;`}
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
		let { children, level = 1, color = TEXT_COLOR, align = "left" } = handle.props;
		let style = `margin:0 0 16px;padding:0;font-family:inherit;font-size:${HEADING_SIZES[level]}px;line-height:1.3;font-weight:600;color:${color};text-align:${align};`;

		if (level === 3) return <h3 style={style}>{children}</h3>;
		if (level === 2) return <h2 style={style}>{children}</h2>;
		return <h1 style={style}>{children}</h1>;
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

		return (
			<p
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
		let {
			href,
			children,
			background = ACTION_COLOR,
			color = ACTION_LABEL_COLOR,
			radius = 6,
		} = handle.props;

		return (
			<table role="presentation" cellPadding="0" cellSpacing="0" style="margin:0 0 16px;">
				<tbody>
					<tr>
						<td align="center" style={`background-color:${background};border-radius:${radius}px;`}>
							<a
								href={href}
								style={`display:inline-block;padding:12px 20px;font-family:inherit;font-size:16px;line-height:1.2;font-weight:600;color:${color};text-decoration:none;`}
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
		let { children, color = MUTED_COLOR, borderColor = BORDER_COLOR } = handle.props;

		return (
			<table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style="width:100%;">
				<tbody>
					<tr>
						<td style={`padding:16px 0 0;border-top:1px solid ${borderColor};`}>
							<div style={`font-family:inherit;font-size:12px;line-height:1.5;color:${color};`}>
								{children}
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		);
	};
}
