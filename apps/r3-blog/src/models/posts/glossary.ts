import { Post } from "~/models/post";
import { glossaryMetaCodec } from "~/models/posts/meta-codecs";

import { createTypedPostModel } from "./typed-post-model";

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

class GlossaryPostBase extends createTypedPostModel<"glossary", GlossaryPost.Meta>(
	"glossary",
	glossaryMetaCodec,
) {}

export class GlossaryPost extends GlossaryPostBase {}
