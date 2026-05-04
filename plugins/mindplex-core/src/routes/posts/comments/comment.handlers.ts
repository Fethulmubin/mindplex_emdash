import type { PluginContext } from "emdash";
import { getPostByIdentifier, listComments } from "../../../services/posts";
import type { ListCommentsParams } from "../../../types/posts";
import { getIdentifierFromRoute } from "../post.handlers";

export async function listPostCommentsHandler(routeCtx: any, ctx: PluginContext) {
	const identifier = getIdentifierFromRoute(routeCtx);
	if (!identifier) return { success: false, error: "Post identifier is required." };

	const url = new URL(routeCtx.request.url);
	const limit = parseInt(url.searchParams.get("limit") || "10", 10);
	const cursor = url.searchParams.get("cursor") || undefined;

	try {
		const post = await getPostByIdentifier(ctx, identifier);
		if (!post) return { success: false, error: "Post not found." };

		const params: ListCommentsParams = { limit, cursor };
		const result = await listComments(ctx, { ...params, postId: post.id });
		return { success: true, data: result };
	} catch (error: any) {
		ctx.log.error("Plugin Error: Failed to list comments", { error: error.message });
		return { success: false, error: "Failed to fetch comments." };
	}
}
