import type { PluginContext } from "emdash";
import { createPostHandler, getPostHandler, getPostsHandler } from "./post.handlers";

export const postRoutes = {
	
	// GET & POST /_emdash/api/plugins/mindplex-core/posts
	posts: {
		public: true,
		handler: async (routeCtx: any, ctx: PluginContext) => {
			switch (routeCtx.request.method) {
				case "GET":
					return getPostsHandler(routeCtx, ctx);
				case "POST":
					return createPostHandler(routeCtx, ctx);
				default:
					throw new Response(JSON.stringify({ error: "Method not allowed" }), {
						status: 405,
						headers: { "Content-Type": "application/json" },
					});
			}
		},
	},

	// GET /_emdash/api/plugins/mindplex-core/posts/:identifier
	"posts/:identifier": {
		public: true,
		handler: getPostHandler,
	},
};
