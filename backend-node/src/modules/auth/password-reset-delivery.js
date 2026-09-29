import { securityConfig } from "../../config/security.config.js";

const developmentCaptures = new Map();
const runtimeEnvironment = process.env.NODE_ENV || "development";

export const passwordResetDeliveryAvailable = () =>
  runtimeEnvironment === "development" || runtimeEnvironment === "test";

export const deliverPasswordReset = async ({ email, token }) => {
  if (!passwordResetDeliveryAvailable()) {
    throw new Error("Password reset email delivery is not configured");
  }

  developmentCaptures.set(email, {
    token,
    resetUrl: `${securityConfig.frontendOrigin}/reset-password?token=${encodeURIComponent(token)}`,
  });
};

export const consumeDevelopmentPasswordReset = (email) => {
  if (securityConfig.isProduction) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const capture = developmentCaptures.get(normalizedEmail) || null;
  developmentCaptures.delete(normalizedEmail);
  return capture;
};
