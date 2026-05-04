import { getPostHandler, listPostsHandler } from "./post.handlers";

export const postRoutes = {
	/**
	 * GET /_emdash/api/plugins/mindplex-core/posts
	 */
	posts: {
		public: true,
		handler: listPostsHandler,
	},

	/**
	 * GET /_emdash/api/plugins/mindplex-core/posts/:identifier
	 */
	"posts/:identifier": {
		public: true,
		handler: getPostHandler,
	},
};
