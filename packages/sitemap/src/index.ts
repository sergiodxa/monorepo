export namespace Sitemap {
	export type Frequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

	export interface URL {
		loc: globalThis.URL;
		updatedAt?: Date;
		frequency?: Frequency;
		priority?: number;
	}

	export interface AppendOptions {
		updatedAt?: Date;
		frequency?: Frequency;
		/** Priority value between 0.0 and 1.0, default is 0.5 */
		priority?: number;
	}
}

export class Sitemap {
	urls = new Set<Sitemap.URL>();

	append(loc: globalThis.URL, options: Sitemap.AppendOptions = {}) {
		this.urls.add({ loc, ...options });
	}

	get size() {
		return this.urls.size;
	}

	toString() {
		return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
			...this.urls,
		].map((url) => {
			let parts = [`<loc>${url.loc.toString()}</loc>`];
			if (url.updatedAt) parts.push(`<lastmod>${url.updatedAt.toISOString()}</lastmod>`);
			if (url.frequency) parts.push(`<changefreq>${url.frequency}</changefreq>`);
			if (url.priority !== undefined) parts.push(`<priority>${url.priority}</priority>`);
			return `<url>${parts.join("")}</url>`;
		})}</urlset>`;
	}
}
