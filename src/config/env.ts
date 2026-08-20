import 'dotenv/config';

/**
 * Centralised, validated environment configuration.
 *
 * Env values are always strings, so numbers are coerced EXPLICITLY here
 * (claude.md §5). Missing required values fail fast at boot rather than
 * surfacing as confusing runtime errors later.
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function toInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

const nodeEnv = optional('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: toInt('PORT', 4000),
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),   
  },

  bcryptSaltRounds: toInt('BCRYPT_SALT_ROUNDS', 12),

  upload: {
    cloudinaryUrl: optional('CLOUDINARY_URL', ''),
    dir: optional('UPLOAD_DIR', 'uploads'),
  },

  defaultCurrency: optional('DEFAULT_CURRENCY', 'LAK'),
} as const;
