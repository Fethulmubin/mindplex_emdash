
import { createPostHandler, getPostHandler, getPostsHandler } from "./post.handlers";

export const postRoutes = {
	
	// GET & POST /_emdash/api/plugins/mindplex-core/posts
	posts: {
		public: true,
		handler: getPostsHandler,
	},

	// GET /_emdash/api/plugins/mindplex-core/posts/:identifier
	"posts/:identifier": {
		public: true,
		handler: getPostHandler,
	},

    "posts/create-post": {
        public: true,
        handler: createPostHandler,
    }
};
