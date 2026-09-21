/**
 * Public (pre-authentication) `remix/ui` views: the marketing landing page, shown to
 * signed-out visitors with its own lightweight document shell and `css()` mixins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { CheckIcon, GlobeIcon, LockIcon, ZapIcon } from "@sdxc/icons";
import { css } from "remix/ui";

import { RESET_CSS } from "./styles";

let landingBody = css({
	margin: "0",
	minHeight: "100vh",
	fontFamily: "system-ui, sans-serif",
	color: "#111827",
	lineHeight: "1.5",
	background: "linear-gradient(to bottom right, #eff6ff, #e0e7ff)",
});

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

let footer = css({ padding: "2rem 0", textAlign: "center", color: "#6b7280" });

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

/** Props for {@link PublicDocument}. */
export interface PublicDocumentProps {
	/** Text used for the `<title>` (rendered verbatim). */
	title: string;
	children: RemixNode;
}

/**
 * Minimal HTML document shell for signed-out public pages: the `<head>` and the
 * marketing gradient body.
 *
 * @param handle - Component handle exposing the shell props.
 * @returns A render function producing the public document markup.
 * @example
 * return ctx.render(<PublicDocument title="Auth SaaS"><LandingPage /></PublicDocument>);
 */
export function PublicDocument(handle: Handle<PublicDocumentProps>) {
	return () => {
		let { title, children } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					<style>{RESET_CSS}</style>
				</head>
				<body mix={[landingBody]}>{children}</body>
			</html>
		);
	};
}

/**
 * Renders the marketing landing page content (hero, feature cards, OIDC capabilities,
 * footer). Preserves the original copy; the calls to action have no sign-up flow to
 * link to yet.
 *
 * @returns A render function producing the landing page markup.
 * @example
 * return ctx.render(<PublicDocument title="Auth SaaS - Authentication as a Service"><LandingPage /></PublicDocument>);
 */
export function LandingPage(): () => RemixNode {
	return () => (
		<>
			<nav mix={[navBar]}>
				<div mix={[navRow]}>
					<h1 mix={[brand]}>Auth SaaS</h1>
					{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid -- Placeholder target: the call to action keeps its place in the layout until there is a sign-up flow to send it to. */}
					<a mix={[primaryButton]} href="#">
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
						{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid -- Placeholder target: the call to action keeps its place in the layout until there is a sign-up flow to send it to. */}
						<a mix={[primaryButtonLg]} href="#">
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
							<LockIcon mix={[featureIcon]} color="#2563eb" />
						</div>
						<h3 mix={[featureTitle]}>Passkey Authentication</h3>
						<p mix={[featureText]}>
							Passwordless, phishing-resistant authentication using WebAuthn. No more password
							resets or credential stuffing attacks.
						</p>
					</div>

					<div mix={[featureCard]}>
						<div mix={[featureIconBox, iconGreen]}>
							<GlobeIcon mix={[featureIcon]} color="#16a34a" />
						</div>
						<h3 mix={[featureTitle]}>Custom Domains</h3>
						<p mix={[featureText]}>
							Use your own domain for authentication. Your users see your brand, not ours. Full SSL
							included.
						</p>
					</div>

					<div mix={[featureCard]}>
						<div mix={[featureIconBox, iconPurple]}>
							<ZapIcon mix={[featureIcon]} color="#9333ea" />
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
								<CheckIcon mix={[checkIcon]} color="#22c55e" />
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
