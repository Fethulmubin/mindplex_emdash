import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { routes } from "./routes";
import { hooks } from "./hooks";

export default definePlugin({
  routes,
  storage: {
    users: { indexes: ["email", "username"] },
    user_profiles: { indexes: ["userId"] },
    user_preferences: { indexes: ["userId"] },
    user_notification_settings: { indexes: ["userId"] },
    user_social_auths: { indexes: ["provider", "providerId", "userId", ["provider", "providerId"]] },
    refresh_tokens: { indexes: ["token", "familyId", "userId"] },
    activation_tokens: { indexes: ["token", "userId"] },
  },

  cron: {
    "recalculate-scores": {
      schedule: "0 * * * *",
      handler: async (ctx: PluginContext) => {
        ctx.log.info("Cron: Recalculating trending scores...");
      },
    },
  },

  hooks,
});
