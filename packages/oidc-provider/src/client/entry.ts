import { run } from "remix/ui";

let app = run({
	async loadModule(moduleUrl, exportName) {
		let mod = await import(moduleUrl);
		return mod[exportName];
	},
	async resolveFrame(src, signal, target) {
		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let res = await fetch(src, { headers, signal });
		return await res.text();
	},
});

await app.ready();
