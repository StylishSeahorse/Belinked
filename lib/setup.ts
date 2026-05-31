type SetupEnv = Record<string, string | undefined>;

function envFlag(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function envValue(value: string | undefined) {
  return String(value || "").trim();
}

export function setupDefaultsFromEnv(env: SetupEnv = process.env) {
  return {
    email: envValue(env.SETUP_EMAIL),
    displayName: envValue(env.SETUP_DISPLAY_NAME)
  };
}

export function ownerSeedFromEnv(env: SetupEnv = process.env) {
  if (!envFlag(env.BELINKED_AUTO_CREATE_OWNER)) return null;

  const email = envValue(env.SETUP_EMAIL);
  const password = envValue(env.SETUP_PASSWORD);
  if (!email || !password) return null;

  return {
    email,
    password,
    displayName: envValue(env.SETUP_DISPLAY_NAME) || "Owner"
  };
}
