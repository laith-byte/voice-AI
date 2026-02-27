type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const configuredLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) in LOG_LEVEL_PRIORITY
    ? (process.env.LOG_LEVEL as LogLevel)
    : "info";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[configuredLevel]) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
  withContext: (baseContext: Record<string, unknown>) => ({
    debug: (message: string, context?: Record<string, unknown>) => log("debug", message, { ...baseContext, ...context }),
    info: (message: string, context?: Record<string, unknown>) => log("info", message, { ...baseContext, ...context }),
    warn: (message: string, context?: Record<string, unknown>) => log("warn", message, { ...baseContext, ...context }),
    error: (message: string, context?: Record<string, unknown>) => log("error", message, { ...baseContext, ...context }),
  }),
};
