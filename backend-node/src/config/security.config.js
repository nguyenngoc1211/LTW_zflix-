import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET?.trim();

if (!jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET is required");
}

const insecureProductionSecret =
  jwtAccessSecret.length < 32 ||
  /(change[-_ ]?me|replace[-_ ]?with|local[-_ ]?development|demo|example|test[-_ ]?only)/i.test(
    jwtAccessSecret,
  );

if (isProduction && insecureProductionSecret) {
  throw new Error("JWT_ACCESS_SECRET must be a strong, non-demo value in production");
}

const configuredOrigin = process.env.FRONTEND_ORIGIN?.trim();
if (isProduction && !configuredOrigin) {
  throw new Error("FRONTEND_ORIGIN is required in production");
}

const originUrl = new URL(configuredOrigin || "http://localhost:5173");
if (!["http:", "https:"].includes(originUrl.protocol)) {
  throw new Error("FRONTEND_ORIGIN must use http or https");
}

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const securityConfig = Object.freeze({
  isProduction,
  jwtAccessSecret,
  jwtAlgorithms: Object.freeze(["HS256"]),
  frontendOrigin: originUrl.origin,
  loginRateLimit: Object.freeze({
    windowMs: positiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: positiveInteger(process.env.LOGIN_RATE_LIMIT_MAX, 10),
  }),
  refreshRateLimit: Object.freeze({
    windowMs: positiveInteger(process.env.REFRESH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: positiveInteger(process.env.REFRESH_RATE_LIMIT_MAX, 120),
  }),
});
