const normalize = (account: string) => account.toUpperCase().replaceAll(/[^A-Z0-9]/g, "_");

/**
 * Environment variable that holds a secret for an account.
 * The default account uses the plain name (DESCO_USERNAME).
 * Other accounts add a suffix (DESCO_USERNAME__OFFICE).
 */
export function secretEnvName(name: string, account: string): string {
  return account === "default" ? name : `${name}__${normalize(account)}`;
}

export function envSecrets(account: string, env: Record<string, string | undefined>) {
  return {
    get(name: string): string | undefined {
      const value = env[secretEnvName(name, account)];
      return value === undefined || value === "" ? undefined : value;
    },
  };
}
