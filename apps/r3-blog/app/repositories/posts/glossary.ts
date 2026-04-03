import type { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";

export namespace GlossaryPost {
	export interface Meta {
		slug: string;
		term: string;
		title?: string;
		definition: string;
	}

	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

function glossaryMetaValue(
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

let glossaryMetaCodec: Post.MetaCodec<GlossaryPost.Meta> = {
	serialize(meta) {
		let rows: Array<{ key: string; value: string }> = [];
		if (typeof meta.slug !== "undefined") rows.push({ key: "slug", value: meta.slug });
		if (typeof meta.term !== "undefined") rows.push({ key: "term", value: meta.term });
		if (typeof meta.title !== "undefined") rows.push({ key: "title", value: meta.title });
		if (typeof meta.definition !== "undefined")
			rows.push({ key: "definition", value: meta.definition });
		return rows;
	},
	deserialize(rows) {
		return {
			slug: glossaryMetaValue(rows, "slug") ?? "",
			term: glossaryMetaValue(rows, "term") ?? "",
			title: glossaryMetaValue(rows, "title"),
			definition: glossaryMetaValue(rows, "definition") ?? "",
		};
	},
};

export class GlossaryPost {
	static postType = "glossary" as const;

	static findAll(db: Database) {
		return Post.findAllForType<"glossary", GlossaryPost.Meta>(db, this.postType, glossaryMetaCodec);
	}

	static count(db: Database) {
		return Post.countForType(db, this.postType);
	}

	static findById(db: Database, id: string) {
		return Post.findByIdForType<"glossary", GlossaryPost.Meta>(
			db,
			this.postType,
			id,
			glossaryMetaCodec,
		);
	}

	static create(db: Database, input: GlossaryPost.CreateInput) {
		return Post.createForType<"glossary", GlossaryPost.Meta>(
			db,
			this.postType,
			input,
			glossaryMetaCodec,
		);
	}

	static update(db: Database, id: string, input: GlossaryPost.UpdateInput) {
		return Post.updateForType<"glossary", GlossaryPost.Meta>(
			db,
			this.postType,
			id,
			input,
			glossaryMetaCodec,
		);
	}

	static destroy(db: Database, id: string) {
		return Post.destroy(db, id);
	}
}
