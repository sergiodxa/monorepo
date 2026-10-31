/**
 * The copy for the React Router OAuth2 Handbook: its promise, the free chapter's opening
 * page, the flow and code it teaches (quoted from that chapter), the packages, the author,
 * the one reader quote it has, and the questions buyers ask.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	AtSignIcon,
	BookOpenIcon,
	FlaskConicalIcon,
	GlobeIcon,
	RocketIcon,
	ShieldCheckIcon,
} from "@sdxc/icons";

import type { BookCopy } from "~/resources/content/books";

import { Product } from "~/config/products";
import ReactRouterOAuth2Cover from "~/resources/views/books/react-router-oauth2-cover";

/** The handbook's copy, read by every page under `/react-router-oauth2`. */
export const REACT_ROUTER_OAUTH2: BookCopy = {
	Cover: ReactRouterOAuth2Cover,
	shortTitle: "OAuth2 Handbook",
	hero: {
		eyebrow: "React Router OAuth2 Handbook",
		title: "OAuth2 in React Router, finally understood",
		description: (
			<>
				A practical, modern guide to implementing <strong>OAuth2 authentication</strong> in React
				Router and Remix apps, built on patterns you can apply to any web application.
			</>
		),
	},
	quote: {
		quote: (
			<>
				I always learned enough of OAuth2 to get the job done, after reading this I finally
				understand how it works.
			</>
		),
		name: "Alem Tuzlak",
		role: (
			<>
				Co-founder of <a href="https://x.com/forge42dev">Forge 42</a>
			</>
		),
		photo: "/alem.png",
	},
	sample: {
		title: "Read a chapter before you buy",
		description: (
			<>
				“OAuth2 in Simple Terms” covers the actors, scopes, well-known endpoints and the{" "}
				<strong>Authorization Code flow with PKCE</strong>. Leave your email and it opens right
				here, with an EPUB for your e-reader.
			</>
		),
		page: {
			runningHead: "OAuth2 Handbook",
			title: "OAuth2 in Simple Terms",
			opening:
				"Before implementing OAuth2, it’s important to understand the core ideas behind it. This guide won’t go into every technical detail, but it will give you the foundation you need to follow along and understand the code.",
			subhead: "Why OAuth2?",
			continuation:
				"OAuth2 was created to solve a common problem: how can applications securely access a user’s data stored in another service?",
		},
	},
	inside: {
		title: "Everything to ship auth right",
		description: (
			<>
				A concise guide and a working app, written for React Router v7 in framework mode, with{" "}
				<strong>the why behind every step</strong>.
			</>
		),
		claims: [
			{
				icon: <BookOpenIcon />,
				title: "A 47-page handbook",
				body: (
					<>
						The core concepts of OAuth2 and OpenID Connect: secure auth flows,{" "}
						<strong>refresh tokens and introspection</strong> endpoints, in a full-stack app.
					</>
				),
			},
			{
				icon: <FlaskConicalIcon />,
				title: "A real example application",
				body: (
					<>
						A complete React Router and OAuth2 app, from login screens to token storage, with code
						you can <strong>run, read and reuse</strong>.
					</>
				),
			},
			{
				icon: <ShieldCheckIcon />,
				title: "A security-first approach",
				body: (
					<>
						Avoid the common pitfalls, like <strong>insecure token handling</strong> or a wrong
						client configuration, by learning why each step exists.
					</>
				),
			},
			{
				icon: <RocketIcon />,
				title: "Ready for framework mode",
				body: (
					<>
						Patterns that drop into React Router and Remix apps with <strong>no boilerplate</strong>
						, respecting both developer experience and security.
					</>
				),
			},
		],
	},
	flow: {
		title: "The flow you will build",
		description: (
			<>
				The book centres on the <strong>Authorization Code flow with PKCE</strong>, the recommended
				default for web apps. This is the flow, and the code, from the free chapter.
			</>
		),
		steps: [
			{
				title: "Create the challenge",
				body: (
					<>
						The client generates a random <code>code_verifier</code> and derives a{" "}
						<code>code_challenge</code> from it.
					</>
				),
			},
			{
				title: "Redirect to sign in",
				body: (
					<>
						The user goes to the Authorization Server along with the <code>code_challenge</code>.
					</>
				),
			},
			{
				title: "Grant access",
				body: <>The user authenticates and grants access to the application.</>,
			},
			{
				title: "Come back with a code",
				body: (
					<>The Authorization Server redirects back to the client with an authorization code.</>
				),
			},
			{
				title: "Exchange it for tokens",
				body: (
					<>
						The client sends the code and the original <code>code_verifier</code>, and gets an
						access token.
					</>
				),
			},
		],
		samples: [
			{
				label: "Authorize",
				language: "ts",
				code: `let codeVerifier = randomToken({ bytes: 32 });
let codeChallenge = await sha256Base64Url(codeVerifier);

let authorizeUrl = new URL("https://auth.example.com/authorize");
authorizeUrl.searchParams.set("client_id", env.clientId);
authorizeUrl.searchParams.set("response_type", "code");
authorizeUrl.searchParams.set("redirect_uri", env.redirectURI);
authorizeUrl.searchParams.set("code_challenge", codeChallenge);
authorizeUrl.searchParams.set("code_challenge_method", "S256");`,
			},
			{
				label: "Exchange",
				language: "ts",
				code: `let response = await fetch("https://auth.example.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: "authorization_code",
    code: authorizationCode,
    redirect_uri: env.redirectURI,
    code_verifier: codeVerifier,
  }),
});`,
			},
		],
	},
	author: {
		title: "Written from real-world auth",
		bio: (
			<>
				Hi, I’m Sergio, a full-stack developer working with TypeScript, React and Rails to build
				scalable apps and secure APIs. Everything I write comes from{" "}
				<strong>things I’ve built, broken and fixed</strong>.
			</>
		),
		credentials: [
			"Years refining OAuth2 flows in production",
			"Deploys to Cloudflare, from the backend to the edge",
			"Writes about web development at sergiodxa.com",
		],
		name: "Sergio Xalambrí",
		jobTitle: "Full-stack developer",
		photo: "/avatar.png",
		links: [
			{ href: "https://sergiodxa.com", label: "Website", icon: <GlobeIcon /> },
			{ href: "https://x.com/sergiodxa", label: "Sergio on X", icon: <AtSignIcon /> },
		],
	},
	pricing: {
		title: "Pick your package",
		description: (
			<>
				One payment, yours to keep. Buying for a team? Write to{" "}
				<a href="mailto:hello@sergiodxa.com">hello@sergiodxa.com</a> with the number of seats for a
				team offer.
			</>
		),
	},
	packages: {
		[Product.Complete]: {
			name: "Complete Package",
			description: "Everything you need to master OAuth2 with React Router in production.",
			features: [
				"The book, in PDF and EPUB",
				"Example web app, API and authorization server",
				"End-to-end tests for the example app",
				"Private Discord access for questions",
			],
			action: "Get the Complete Package",
		},
		[Product.Essentials]: {
			name: "The Book",
			description: "The complete guide, from login to token refresh and everything between.",
			features: ["The book, in PDF and EPUB", "Every OAuth2 flow it covers, explained"],
			action: "Buy the book",
		},
	},
	upgrade: {
		title: "Already have The Book?",
		description: "Upgrade to the Complete Package and pay only the difference.",
		action: "Upgrade now",
	},
	faq: [
		[
			"What do I need to know before reading this book?",
			"You should be comfortable with React Router. While the concepts are framework-agnostic, the example app uses React Router v7 in framework mode. If you know another framework, you’ll still be able to follow along — just expect some differences in routing.",
		],
		[
			"Does this work with Remix or other frameworks?",
			"Yes. The patterns and flows described are not tied to any specific framework. While the example app uses React Router, the principles apply to Remix, Next.js, SvelteKit, and others.",
		],
		[
			"Does it cover login with Google, GitHub, etc.?",
			"The book focuses on the Authorization Code flow with PKCE, which underpins most third-party logins. Once you understand that, adapting it to use providers like Google or GitHub is straightforward.",
		],
		[
			"What’s the difference between the book and the complete package?",
			"The book includes the full 47-page guide in PDF and EPUB formats. The Complete Package adds a working example app (web, API, auth server, and tests) plus private Discord access for questions and support.",
		],
		[
			"Can I use the example app in production?",
			"The example app is designed for learning purposes. While it reflects real-world practices, I only recommend using the web app portion as a starting point. The API and Authorization Server are simplified and meant to illustrate concepts — not for production use.",
		],
		[
			"What am I allowed to do with the example codebase?",
			"The example app is provided for educational purposes only. You’re welcome to explore, adapt, and learn from it — but please don’t redistribute or repackage it commercially.",
		],
		[
			"Can I purchase multiple licenses for my team at a reduced price?",
			"Yes! Reach out to me at hello@sergiodxa.com with the number of seats you need, and I’ll send you a custom team offer.",
		],
		[
			"What if I get stuck or have questions?",
			"If you buy the Complete Package, you’ll be invited to a private Discord server where you can ask questions and get support directly from me and the community.",
		],
		[
			"Is purchasing power parity (PPP) pricing available?",
			"Outside the early access campaign, a banner offers a discount code for The Book when you visit from a country with lower purchasing power. During early access, the Complete Package carries the deepest discount it will ever get, and PPP does not apply to it.",
		],
	],
	closing: {
		title: "Ship sign-in you can explain",
		description: "Start with the free chapter, or get the whole handbook today.",
	},
};
