import type { PluginContext } from "emdash";
import type { CreatePostInput, ListPostsParams } from "../types/post.schema";

export async function listPosts(ctx: PluginContext, params: ListPostsParams) {
	const options: any = {
		limit: Math.min(params.limit ?? 10, 100),
		cursor: params.cursor,
		where: {
			status: "published",
		},
	};

	if (params.type) {
		options.where.type = params.type;
	}

	if (params.feed === "editors-pick") {
		options.where.is_editors_pick = true;
	}

	return ctx.content!.list("posts", options);
}

export async function createPost(ctx: PluginContext, input: CreatePostInput) {
	return ctx.content!.create!("posts", {
		title: input.title,
		content: input.content || "",
		excerpt: input.excerpt,
		estimated_reading_minutes: input.estimated_reading_minutes,
		type: input.type || "article",
		author: input.author_id,
		slug: input.slug || undefined,
		status: input.status || "draft",
	});
}
