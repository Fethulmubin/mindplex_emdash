import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import { routes } from "./routes";
import { hooks } from "./hooks";

export default definePlugin({
  routes,

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
