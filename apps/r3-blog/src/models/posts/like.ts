import { Post } from "~/models/post";
import { likeMetaCodec } from "~/models/posts/meta-codecs";

import { createTypedPostModel } from "./typed-post-model";

export namespace LikePost {
	export interface Meta {
		title: string;
		url: string;
	}

	export interface CreateInput extends Post.TypedCreateInput<Meta> {}

	export interface UpdateInput extends Post.TypedUpdateInput<Meta> {}
}

class LikePostBase extends createTypedPostModel<"like", LikePost.Meta>("like", likeMetaCodec) {}

export class LikePost extends LikePostBase {
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
