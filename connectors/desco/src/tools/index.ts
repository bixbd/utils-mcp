import { accountTools } from "./accounts";
import { billingTools } from "./billing";
import { directoryTools } from "./directory";
import { infoTools } from "./info";
import { profileTools } from "./profile";
import { usageTools } from "./usage";

/** Every DESCO tool, signed-in first, then public lookups. */
export const tools = [
  ...accountTools,
  ...profileTools,
  ...usageTools,
  ...billingTools,
  ...infoTools,
  ...directoryTools,
];
