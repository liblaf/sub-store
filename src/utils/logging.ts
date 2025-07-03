import { type ISettingsParam, Logger } from "tslog";

export function getLogger<LogObj>(
  settings?: ISettingsParam<LogObj>,
  logObj?: LogObj,
): Logger<LogObj> {
  return new Logger(settings, logObj);
}
