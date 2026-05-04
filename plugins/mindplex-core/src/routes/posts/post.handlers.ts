import type { PluginContext } from "emdash";
import { createPost, getPostByIdentifier, getPosts } from "../../services/posts";
import type { CreatePostInput } from "../../types/posts";

export function getIdentifierFromRoute(routeCtx: any): string | null {
	if (routeCtx?.params?.identifier) return routeCtx.params.identifier;

	const url = new URL(routeCtx.request.url);
	const segments = url.pathname.split("/").filter(Boolean);
	const postsIndex = segments.lastIndexOf("posts");

	if (postsIndex >= 0 && segments[postsIndex + 1]) {
		return segments[postsIndex + 1];
	}

	return null;
}

export async function getPostsHandler(routeCtx: any, ctx: PluginContext) {
	const url = new URL(routeCtx.request.url);
	const type = url.searchParams.get("type");
	const feed = url.searchParams.get("feed");
	const sort = url.searchParams.get("sort");
	const limit = parseInt(url.searchParams.get("limit") || "10", 10);
	const cursor = url.searchParams.get("cursor") || undefined;

	try {
		const result = await getPosts(ctx, {
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
}

export async function getPostHandler(routeCtx: any, ctx: PluginContext) {
	const identifier = getIdentifierFromRoute(routeCtx);
	if (!identifier) return { success: false, error: "Post identifier is required." };

	try {
		const post = await getPostByIdentifier(ctx, identifier);
		if (!post) return { success: false, error: "Post not found." };
		return { success: true, data: post };
	} catch (error: any) {
		ctx.log.error("Plugin Error: Failed to get post", { error: error.message });
		return { success: false, error: "Failed to fetch post." };
	}
}

export async function createPostHandler(routeCtx: any, ctx: PluginContext) {
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
}

