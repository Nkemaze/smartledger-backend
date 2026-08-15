import { app } from "./app";
import { env } from "@config/env";
import { logger } from "@utils/logger";
import { scheduleDailySalesSummary } from "@jobs/dailySalesSummary.job";
import { startBaileys } from "@services/baileys.service";

app.listen(env.port, () => {
  logger.info(`SmartLedger API running on http://localhost:${env.port}`);
  scheduleDailySalesSummary();
  startBaileys();
});
