import { securityConfig } from "../../config/security.config.js";
import { pool } from "../../core/database/pool.js";

export const cleanupAuthData = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [sessions] = await connection.execute(
      `DELETE FROM auth_sessions
       WHERE (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
          OR expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
          OR absolute_expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
      [
        securityConfig.cleanup.sessionRetentionDays,
        securityConfig.cleanup.sessionRetentionDays,
        securityConfig.cleanup.sessionRetentionDays,
      ],
    );
    const [passwordResets] = await connection.execute(
      `DELETE FROM password_reset_tokens
       WHERE (used_at IS NOT NULL AND used_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
          OR expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
      [
        securityConfig.cleanup.passwordResetRetentionDays,
        securityConfig.cleanup.passwordResetRetentionDays,
      ],
    );
    const [mfaChallenges] = await connection.execute(
      `DELETE FROM auth_mfa_challenges
       WHERE (used_at IS NOT NULL AND used_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
          OR expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
      [
        securityConfig.cleanup.mfaChallengeRetentionDays,
        securityConfig.cleanup.mfaChallengeRetentionDays,
      ],
    );
    const [usedRecoveryCodes] = await connection.execute(
      `DELETE FROM auth_mfa_recovery_codes
       WHERE used_at IS NOT NULL
         AND used_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)`,
      [securityConfig.cleanup.usedRecoveryCodeRetentionDays],
    );
    await connection.commit();
    return {
      auth_sessions_deleted: sessions.affectedRows,
      password_reset_tokens_deleted: passwordResets.affectedRows,
      mfa_challenges_deleted: mfaChallenges.affectedRows,
      used_recovery_codes_deleted: usedRecoveryCodes.affectedRows,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
