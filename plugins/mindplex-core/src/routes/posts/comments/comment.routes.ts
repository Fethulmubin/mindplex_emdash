import { listPostCommentsHandler } from "./comment.handlers";

export const commentRoutes = {
	/**
	 * GET /_emdash/api/plugins/mindplex-core/posts/:identifier/comments
	 */
	"posts/:identifier/comments": {
		public: true,
		handler: listPostCommentsHandler,
	},
};
