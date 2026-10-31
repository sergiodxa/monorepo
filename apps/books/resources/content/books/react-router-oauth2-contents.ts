/**
 * The React Router OAuth2 Handbook's table of contents, taken from the manuscript: each
 * chapter with its sections and a line or two on what each one covers, then the appendices.
 * The free chapter is flagged, so the landing can mark what a reader gets for an email.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BookCopy } from "~/resources/content/books";

/** The book's chapters, in reading order, each with its sections. */
const CHAPTERS: BookCopy.ContentsPart[] = [
	{
		title: "Introduction",
		lessons: [
			{
				number: "–",
				title: "What you will build",
				summary:
					"What the handbook covers and the app you build: the Authorization Code flow with PKCE in React Router, with ideas that carry to any framework.",
			},
		],
	},
	{
		title: "Chapter 1 · OAuth2 in Simple Terms",
		free: true,
		lessons: [
			{
				number: "1.1",
				title: "Why OAuth2?",
				summary:
					"The problem OAuth2 solves: letting an app reach a user’s data in another service without ever handling their password.",
			},
			{
				number: "1.2",
				title: "How OAuth2 Works",
				summary:
					"How a client gets a token from an Authorization Server to act on a user’s behalf, and how refresh tokens and scopes fit in.",
			},
			{
				number: "1.3",
				title: "OpenID Connect",
				summary:
					"The identity layer on top of OAuth2, and the ID Token that tells your app who signed in.",
			},
			{
				number: "1.4",
				title: "Actors in OAuth2",
				summary:
					"The four roles in every flow: Resource Owner, Resource Server, Client Application and Authorization Server.",
			},
			{
				number: "1.5",
				title: "Scopes",
				summary:
					"How scopes limit what an app can do with a token, following the principle of least privilege.",
			},
			{
				number: "1.6",
				title: "Well-Known Endpoints",
				summary:
					"The metadata, OpenID configuration and JWKS endpoints that let a client discover an Authorization Server instead of hardcoding it.",
			},
			{
				number: "1.7",
				title: "OAuth2 Flows",
				summary:
					"The Authorization Code flow with PKCE step by step, with the code for it, and a first look at the other flows.",
			},
		],
	},
	{
		title: "Chapter 2 · Tokens in OAuth2",
		lessons: [
			{
				number: "2.1",
				title: "Authorization Code",
				summary:
					"The short-lived credential a client receives after the user grants access, and exchanges for tokens.",
			},
			{
				number: "2.2",
				title: "Access Token",
				summary:
					"The bearer credential sent to the Resource Server, why it is short-lived, and why storing it safely matters.",
			},
			{
				number: "2.3",
				title: "Refresh Token",
				summary:
					"How a client gets a new access token without asking the user to sign in again, and why it never reaches the Resource Server.",
			},
			{
				number: "2.4",
				title: "ID Tokens in OIDC",
				summary:
					"The JWT that carries who the user is, read by the client and never used to call an API.",
			},
			{
				number: "2.5",
				title: "Token Formats",
				summary:
					"Opaque tokens against JSON Web Tokens: how each is verified, and when to choose one over the other.",
			},
			{
				number: "2.6",
				title: "Token Claims",
				summary:
					"What aud, iss, sub, exp, scope and jti mean, and how to check each one before trusting a token.",
			},
		],
	},
	{
		title: "Chapter 3 · Building the Application",
		lessons: [
			{
				number: "3.1",
				title: "How the Application Will Work",
				summary:
					"The contact list app built on React Router’s Address Book tutorial, where the browser never sees a token.",
			},
			{
				number: "3.2",
				title: "The Authorization Server",
				summary:
					"Choosing between managed, self-hosted and built-in servers, and the minimal one the example uses to issue JWTs.",
			},
			{
				number: "3.3",
				title: "The Resource Server",
				summary:
					"Protecting the contacts API by verifying opaque tokens through introspection, or JWTs against the JWKS.",
			},
			{
				number: "3.4",
				title: "The Client Application",
				summary:
					"Remix Auth in React Router: sessions, the authorization route, calling the API, logging out, revocation, RP-initiated logout and refresh token rotation.",
			},
		],
	},
	{
		title: "Conclusion",
		lessons: [
			{
				number: "–",
				title: "What you learned",
				summary:
					"A recap of the secure setup you built, and why each decision matters in production with any server-side framework.",
			},
		],
	},
];

/** The appendices, which the landing lists together after the chapters. */
const APPENDICES: BookCopy.ContentsLesson[] = [
	{
		number: "A",
		title: "JSON Web Tokens (JWT)",
		summary:
			"How JWTs compare with opaque tokens, sessions and cookies, and the trade-offs of each.",
	},
	{
		number: "B",
		title: "With Access Token in Session",
		summary:
			"A variation that keeps the access token in the session too, refreshing it only when it expires, with rotation.",
	},
	{
		number: "C",
		title: "Other OAuth2 Flows",
		summary:
			"Authorization Code without PKCE, Implicit, Client Credentials, ROPC and Device Authorization, and how to choose between them.",
	},
	{
		number: "D",
		title: "Error Handling",
		summary:
			"The errors OAuth2 defines, and how to handle them in your authentication route with Remix Auth OAuth2.",
	},
	{
		number: "E",
		title: "The Backend for Frontend (BFF) Pattern in React Router",
		summary:
			"Why React Router’s loaders and actions already act as a BFF, keeping tokens on the server and away from the browser.",
	},
	{
		number: "F",
		title: "Glossary",
		summary: "Short definitions of the OAuth2, OpenID Connect and JWT terms used across the book.",
	},
	{
		number: "G",
		title: "Comparison Tables",
		summary:
			"Quick references: OAuth2 against OpenID Connect, JWT against opaque tokens, the three token types, and the flows.",
	},
];

/**
 * The full contents: the chapters, then one part holding every appendix. Introduction and
 * Conclusion are counted as the book's opening and closing, not as numbered chapters.
 */
export const CONTENTS: BookCopy.Contents = {
	title: `${CHAPTERS.length - 2} chapters and ${APPENDICES.length} appendices`,
	parts: [...CHAPTERS, { title: "Appendices", lessons: APPENDICES }],
};
