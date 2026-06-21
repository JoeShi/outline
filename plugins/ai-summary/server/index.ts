import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import router from "./api/aiSummary";
import env from "./env";
import AISummaryTask from "./tasks/AISummaryTask";

const enabled =
  !!env.AI_SUMMARY_BEDROCK_REGION &&
  !!(env.AI_SUMMARY_BEDROCK_ACCESS_KEY_ID && env.AI_SUMMARY_BEDROCK_SECRET_ACCESS_KEY);

if (enabled) {
  PluginManager.add([
    {
      ...config,
      type: Hook.API,
      value: router,
    },
    {
      ...config,
      type: Hook.Task,
      value: AISummaryTask,
    },
  ]);
}
