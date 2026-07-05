/**
 * Public (pre-authentication) `remix/ui` views: the marketing landing page and the
 * onboarding authentication-error page. These pages are shown to signed-out visitors,
 * so they use their own lightweight document shell and `css()` mixins rather than the
 * dashboard {@link import("./document").Document} (which carries authenticated nav
 * chrome). Replaces the former Tailwind-CDN `html()` string templates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import routes from "~/routes/web";

import { RESET_CSS } from "./styles";

// ---- Shared shell ----

/** Page body background for the marketing landing page (blue→indigo gradient). */
let landingBody = css({
	margin: "0",
	minHeight: "100vh",
	fontFamily: "system-ui, sans-serif",
	color: "#111827",
	lineHeight: "1.5",
	background: "linear-gradient(to bottom right, #eff6ff, #e0e7ff)",
});

/** Page body background for the neutral, centered auth-error page. */
let errorBody = css({
	margin: "0",
	minHeight: "100vh",
	fontFamily: "system-ui, sans-serif",
	color: "#111827",
	lineHeight: "1.5",
	background: "#f9fafb",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
});

// ---- Landing layout ----

let navBar = css({ padding: "1.5rem 0" });

let navRow = css({
	maxWidth: "72rem",
	margin: "0 auto",
	padding: "0 1rem",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
});

let brand = css({ fontSize: "1.5rem", fontWeight: "700", color: "#111827", margin: "0" });

let mainContent = css({ maxWidth: "72rem", margin: "0 auto", padding: "4rem 1rem" });

let hero = css({ textAlign: "center", marginBottom: "4rem" });

let heroTitle = css({
	fontSize: "3rem",
	fontWeight: "700",
	color: "#111827",
	margin: "0 0 1.5rem",
});

let heroLead = css({
	fontSize: "1.25rem",
	color: "#4b5563",
	maxWidth: "42rem",
	margin: "0 auto 2rem",
});

let heroActions = css({ display: "flex", gap: "1rem", justifyContent: "center" });

// ---- Buttons ----

let primaryButton = css({
	display: "inline-block",
	background: "#2563eb",
	color: "#ffffff",
	padding: "0.5rem 1rem",
	borderRadius: "0.5rem",
	textDecoration: "none",
	fontWeight: "500",
	"&:hover": { background: "#1d4ed8" },
});

let primaryButtonLg = css({
	display: "inline-block",
	background: "#2563eb",
	color: "#ffffff",
	padding: "0.75rem 2rem",
	borderRadius: "0.5rem",
	fontSize: "1.125rem",
	fontWeight: "500",
	textDecoration: "none",
	"&:hover": { background: "#1d4ed8" },
});

let secondaryButtonLg = css({
	display: "inline-block",
	background: "#ffffff",
	color: "#374151",
	padding: "0.75rem 2rem",
	borderRadius: "0.5rem",
	fontSize: "1.125rem",
	fontWeight: "500",
	textDecoration: "none",
	border: "1px solid #e5e7eb",
	"&:hover": { background: "#f9fafb" },
});

// ---- Feature cards ----

let featureGrid = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
	gap: "2rem",
	marginBottom: "4rem",
});

let featureCard = css({
	background: "#ffffff",
	borderRadius: "0.75rem",
	padding: "1.5rem",
	boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
});

let featureIconBox = css({
	width: "3rem",
	height: "3rem",
	borderRadius: "0.5rem",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	marginBottom: "1rem",
});

let iconBlue = css({ background: "#dbeafe" });
let iconGreen = css({ background: "#dcfce7" });
let iconPurple = css({ background: "#f3e8ff" });

let featureIcon = css({ width: "1.5rem", height: "1.5rem" });

let featureTitle = css({ fontSize: "1.125rem", fontWeight: "600", margin: "0 0 0.5rem" });

let featureText = css({ color: "#4b5563", margin: "0" });

// ---- OIDC capabilities panel ----

let panel = css({
	background: "#ffffff",
	borderRadius: "0.75rem",
	padding: "2rem",
	boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
});

let panelTitle = css({
	fontSize: "1.5rem",
	fontWeight: "700",
	textAlign: "center",
	margin: "0 0 2rem",
});

let capabilityGrid = css({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
	gap: "1rem",
});

let capabilityItem = css({ display: "flex", alignItems: "center", gap: "0.5rem" });

let checkIcon = css({ width: "1.25rem", height: "1.25rem", color: "#22c55e", flexShrink: "0" });

// ---- Footer ----

let footer = css({ padding: "2rem 0", textAlign: "center", color: "#6b7280" });

// ---- Error page ----

let errorWrap = css({ maxWidth: "28rem", width: "100%", padding: "0 1rem" });

let errorCard = css({
	background: "#ffffff",
	borderRadius: "0.5rem",
	border: "1px solid #e5e7eb",
	boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
	padding: "1.5rem",
	textAlign: "center",
});

let errorTitle = css({
	fontSize: "1.25rem",
	fontWeight: "700",
	color: "#dc2626",
	margin: "0 0 1rem",
});

let errorMessage = css({ color: "#4b5563", margin: "0 0 1rem" });

let errorLink = css({
	color: "#2563eb",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

/** One OIDC capability rendered with a green check icon in the capabilities panel. */
let CAPABILITIES: string[] = [
	"Authorization Code + PKCE",
	"Client Credentials",
	"Refresh Tokens",
	"Token Introspection",
	"RP-Initiated Logout",
	"Back-Channel Logout",
	"JWKS Endpoint",
	"Discovery Endpoints",
];

/**
 * Renders a green checkmark icon used beside each OIDC capability.
 *
 * @returns A `remix/ui` SVG check icon node.
 * @example
 * <span mix={[capabilityItem]}>{checkIconNode()} JWKS Endpoint</span>
 */
function checkIconNode(): RemixNode {
	return (
		<svg mix={[checkIcon]} fill="currentColor" viewBox="0 0 20 20">
			<path
				fill-rule="evenodd"
				clip-rule="evenodd"
				d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
			/>
		</svg>
	);
}

/** Props for {@link PublicDocument}. */
export interface PublicDocumentProps {
	/** Text used for the `<title>` (rendered verbatim). */
	title: string;
	/** Which body background to use: the marketing gradient or the neutral error page. */
	variant: "landing" | "error";
	/** Page body content. */
	children: RemixNode;
}

/**
 * Minimal HTML document shell for signed-out public pages. Provides the `<head>` and a
 * body styled per {@link PublicDocumentProps.variant}, without the authenticated
 * dashboard navigation.
 *
 * @param handle - Component handle exposing the shell props.
 * @returns A render function producing the public document markup.
 * @example
 * return ctx.render(<PublicDocument title="Auth SaaS" variant="landing"><LandingPage /></PublicDocument>);
 */
export function PublicDocument(handle: Handle<PublicDocumentProps>) {
	return () => {
		let { title, variant, children } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					<style>{RESET_CSS}</style>
				</head>
				<body mix={[variant === "landing" ? landingBody : errorBody]}>{children}</body>
			</html>
		);
	};
}

/**
 * Renders the marketing landing page content (hero, feature cards, OIDC capabilities,
 * footer). Preserves the original copy and the "Get Started"/"Start Free" links into
 * the onboarding flow.
 *
 * @returns A render function producing the landing page markup.
 * @example
 * return ctx.render(<PublicDocument title="Auth SaaS - Authentication as a Service" variant="landing"><LandingPage /></PublicDocument>);
 */
export function LandingPage(): () => RemixNode {
	return () => (
		<>
			<nav mix={[navBar]}>
				<div mix={[navRow]}>
					<h1 mix={[brand]}>Auth SaaS</h1>
					<a mix={[primaryButton]} href={routes.onboarding.index.href()}>
						Get Started
					</a>
				</div>
			</nav>

			<main mix={[mainContent]}>
				<div mix={[hero]}>
					<h2 mix={[heroTitle]}>Authentication Made Simple</h2>
					<p mix={[heroLead]}>
						A fully-featured OIDC provider for your applications. Passkey-first authentication,
						custom domains, and instant deployment.
					</p>
					<div mix={[heroActions]}>
						<a mix={[primaryButtonLg]} href={routes.onboarding.index.href()}>
							Start Free
						</a>
						<a mix={[secondaryButtonLg]} href="#features">
							Learn More
						</a>
					</div>
				</div>

				<div id="features" mix={[featureGrid]}>
					<div mix={[featureCard]}>
						<div mix={[featureIconBox, iconBlue]}>
							<svg mix={[featureIcon]} fill="none" stroke="#2563eb" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
						</div>
						<h3 mix={[featureTitle]}>Passkey Authentication</h3>
						<p mix={[featureText]}>
							Passwordless, phishing-resistant authentication using WebAuthn. No more password
							resets or credential stuffing attacks.
						</p>
					</div>

					<div mix={[featureCard]}>
						<div mix={[featureIconBox, iconGreen]}>
							<svg mix={[featureIcon]} fill="none" stroke="#16a34a" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
								/>
							</svg>
						</div>
						<h3 mix={[featureTitle]}>Custom Domains</h3>
						<p mix={[featureText]}>
							Use your own domain for authentication. Your users see your brand, not ours. Full SSL
							included.
						</p>
					</div>

					<div mix={[featureCard]}>
						<div mix={[featureIconBox, iconPurple]}>
							<svg mix={[featureIcon]} fill="none" stroke="#9333ea" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
						</div>
						<h3 mix={[featureTitle]}>Edge Deployment</h3>
						<p mix={[featureText]}>
							Deployed globally on Cloudflare's edge network. Low latency authentication from
							anywhere in the world.
						</p>
					</div>
				</div>

				<div mix={[panel]}>
					<h3 mix={[panelTitle]}>Complete OIDC Features</h3>
					<div mix={[capabilityGrid]}>
						{CAPABILITIES.map((capability) => (
							<div mix={[capabilityItem]} key={capability}>
								{checkIconNode()}
								<span>{capability}</span>
							</div>
						))}
					</div>
				</div>
			</main>

			<footer mix={[footer]}>
				<p>© 2026 Auth SaaS. Built with Cloudflare Workers.</p>
			</footer>
		</>
	);
}

/** Props for {@link AuthErrorPage}. */
export interface AuthErrorPageProps {
	/** The error message shown to the visitor. */
	message: string;
}

/**
 * Renders the onboarding authentication-error card with the given message and a link
 * back into the onboarding flow. Preserves the original copy and "Try again" link.
 *
 * @param handle - Component handle exposing the error message.
 * @returns A render function producing the error card markup.
 * @example
 * return ctx.render(<PublicDocument title="Authentication Error - Auth SaaS" variant="error"><AuthErrorPage message="Authentication failed. Please try again." /></PublicDocument>, { status: 400 });
 */
export function AuthErrorPage(handle: Handle<AuthErrorPageProps>) {
	return () => {
		let { message } = handle.props;
		return (
			<div mix={[errorWrap]}>
				<div mix={[errorCard]}>
					<h1 mix={[errorTitle]}>Authentication Error</h1>
					<p mix={[errorMessage]}>{message}</p>
					<a mix={[errorLink]} href={routes.onboarding.index.href()}>
						Try again
					</a>
				</div>
			</div>
		);
	};
}
