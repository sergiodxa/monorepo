import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";

export namespace LikePost {
	export interface Meta {
		title: string;
		url: string;
	}

	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

function likeMetaValue(
	rows: Array<{ key: string; value: string; created_at: string; updated_at: string }>,
	key: string,
) {
	let sortedRows = [...rows].sort((a, b) => {
		let keyCompare = String(a.key).localeCompare(String(b.key));
		if (keyCompare !== 0) return keyCompare;

		let updatedCompare = String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? ""));
		if (updatedCompare !== 0) return updatedCompare;

		return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
	});

	for (let row of sortedRows) {
		if (row.key === key) return row.value;
	}

	return undefined;
}

let likeMetaCodec: Post.MetaCodec<LikePost.Meta> = {
	serialize(meta) {
		let rows: Array<{ key: string; value: string }> = [];
		if (typeof meta.title !== "undefined") rows.push({ key: "title", value: meta.title });
		if (typeof meta.url !== "undefined") rows.push({ key: "url", value: meta.url });
		return rows;
	},
	deserialize(rows) {
		return {
			title: likeMetaValue(rows, "title") ?? "",
			url: likeMetaValue(rows, "url") ?? "",
		};
	},
};

export class LikePost {
	static postType = "like" as const;

	static findAll(db: Database) {
		return Post.findAllForType<"like", LikePost.Meta>(db, this.postType, likeMetaCodec);
	}

	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	static findById(db: Database, id: string) {
		return Post.findByIdForType<"like", LikePost.Meta>(db, this.postType, id, likeMetaCodec);
	}

	static create(db: Database, input: LikePost.CreateInput) {
		return Post.createForType<"like", LikePost.Meta>(db, this.postType, input, likeMetaCodec);
	}

	static update(db: Database, id: string, input: LikePost.UpdateInput) {
		return Post.updateForType<"like", LikePost.Meta>(db, this.postType, id, input, likeMetaCodec);
	}

	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}

	static normalizeUrl(url: string) {
		if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/")) {
			return url;
		}

		return `https://${url}`;
	}

	static waybackSnapshotUrl(url: string, created_at: string) {
		let created = new Date(created_at);
		if (Number.isNaN(created.getTime())) return null;

		let date = created
			.toISOString()
			.replaceAll("-", "")
			.replaceAll(":", "")
			.replaceAll(".", "")
			.replace("T", "");

		return `https://web.archive.org/web/${date}/${url}`;
	}
}
