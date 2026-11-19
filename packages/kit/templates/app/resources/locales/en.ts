/**
 * The app's English copy, the bundle every other language mirrors. Declared `as const`, so
 * each message's text types the values its key takes wherever the app translates.
 */

export default {
	home: {
		title: "Welcome",
		body: "Edit {#file}app/http/controllers/home.tsx{/file}, or add a page with {#command}sdxc make controller <name>{/command}.",
	},
	notFound: {
		title: "Not found",
		back: "Back home",
	},
} as const;
