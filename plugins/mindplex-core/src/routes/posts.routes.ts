import type { PluginContext } from "emdash";
import { createPost, listPosts } from "../services/post.service";
import type { CreatePostInput } from "../types/post.schema";

export const postRoutes = {
	/**
	 * GET /_emdash/api/plugins/mindplex-core/posts
	 */
	posts: {
		public: true,
		handler: async (routeCtx: any, ctx: PluginContext) => {
			const url = new URL(routeCtx.request.url);
			const type = url.searchParams.get("type");
			const feed = url.searchParams.get("feed");
			const sort = url.searchParams.get("sort");
			const limit = parseInt(url.searchParams.get("limit") || "10", 10);
			const cursor = url.searchParams.get("cursor") || undefined;

			try {
				const result = await listPosts(ctx, {
					type: type || undefined,
					feed: feed || undefined,
					sort: sort || undefined,
					limit,
					cursor,
				});
				return { success: true, data: result };
			} catch (error: any) {
				ctx.log.error("Plugin Error: Failed to list posts", { error: error.message });
				return { success: false, error: "Failed to fetch posts." };
			}
		},
	},

	/**
	 * POST /_emdash/api/plugins/mindplex-core/create-post
	 *
	 * Creates a new post. Matches the logic from the original Hono backend.
	 */
	"create-post": {
		public: false,
		handler: async (routeCtx: any, ctx: PluginContext) => {
			const input = routeCtx.input as CreatePostInput;
			if (!input?.title) return { success: false, error: "Title is required." };

			try {
				const post = await createPost(ctx, input);
				ctx.log.info(`Post created via plugin: ${post.id}`);
				return { success: true, data: post };
			} catch (error: any) {
				ctx.log.error("Plugin Error: Failed to create post", { error: error.message });
				return { success: false, error: error.message || "Failed to create post." };
			}
		},
	},
};
