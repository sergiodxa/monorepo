import { run } from "remix/component";

let app = run(document, {
	async loadModule(moduleUrl, exportName) {
		let mod = await import(moduleUrl);
		return mod[exportName];
	},
	async resolveFrame(src) {
		let res = await fetch(src, { headers: { accept: "text/html" } });
		return await res.text();
	},
});

await app.ready();
