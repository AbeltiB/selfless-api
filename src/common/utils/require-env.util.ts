/** Fails fast at boot instead of silently signing/verifying JWTs with a guessable fallback secret. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
