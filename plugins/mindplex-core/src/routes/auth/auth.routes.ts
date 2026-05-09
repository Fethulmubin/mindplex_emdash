import {
	activateHandler,
	loginHandler,
	logoutHandler,
	refreshHandler,
	registerHandler,
	socialLoginHandler,
} from "./auth.handlers";

export const authRoutes = {
	// POST /_emdash/api/plugins/mindplex-core/auth/login
	"auth/login": {
		public: true,
		handler: loginHandler,
	},

	// POST /_emdash/api/plugins/mindplex-core/auth/register
	"auth/register": {
		public: true,
		handler: registerHandler,
	},

	// POST /_emdash/api/plugins/mindplex-core/auth/activate
	"auth/activate": {
		public: true,
		handler: activateHandler,
	},

	// POST /_emdash/api/plugins/mindplex-core/auth/social
	"auth/social": {
		public: true,
		handler: socialLoginHandler,
	},

	// POST /_emdash/api/plugins/mindplex-core/auth/refresh
	"auth/refresh": {
		public: true,
		handler: refreshHandler,
	},

	// POST /_emdash/api/plugins/mindplex-core/auth/logout
	"auth/logout": {
		public: true,
		handler: logoutHandler,
	},
};
