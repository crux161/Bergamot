export interface StoredAccountUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface StoredAccount extends StoredAccountUser {
  key: string;
  server_url: string;
  token: string;
  last_used_at: string;
}

const STORED_ACCOUNTS_KEY = "bergamot_saved_accounts";
const ACTIVE_ACCOUNT_KEY = "bergamot_active_account";
const TOKEN_KEY = "bergamot_token";
const SERVER_URL_KEY = "bergamot_server_url";

function normalizeServerUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function buildAccountKey(userId: string, serverUrl: string): string {
  return `${normalizeServerUrl(serverUrl)}::${userId}`;
}

function safeParseAccounts(raw: string | null): StoredAccount[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is StoredAccount => {
      return (
        entry &&
        typeof entry === "object" &&
        typeof entry.key === "string" &&
        typeof entry.id === "string" &&
        typeof entry.username === "string" &&
        typeof entry.server_url === "string" &&
        typeof entry.token === "string" &&
        typeof entry.last_used_at === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(STORED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function sortAccounts(accounts: StoredAccount[]): StoredAccount[] {
  return [...accounts].sort((left, right) => right.last_used_at.localeCompare(left.last_used_at));
}

export function listStoredAccounts(): StoredAccount[] {
  return sortAccounts(safeParseAccounts(localStorage.getItem(STORED_ACCOUNTS_KEY)));
}

export function rememberStoredAccount(user: StoredAccountUser, serverUrl: string, token: string): StoredAccount {
  const cleanServerUrl = normalizeServerUrl(serverUrl);
  const next: StoredAccount = {
    key: buildAccountKey(user.id, cleanServerUrl),
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    server_url: cleanServerUrl,
    token,
    last_used_at: new Date().toISOString(),
  };

  const existing = listStoredAccounts().filter((account) => account.key !== next.key);
  const accounts = sortAccounts([next, ...existing]);
  writeAccounts(accounts);
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, next.key);
  return next;
}

export function getActiveAccountKey(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export function getActiveStoredAccount(): StoredAccount | null {
  const activeKey = getActiveAccountKey();
  if (!activeKey) return null;
  return listStoredAccounts().find((account) => account.key === activeKey) || null;
}

export function activateStoredAccount(accountKey: string): StoredAccount | null {
  const account = listStoredAccounts().find((candidate) => candidate.key === accountKey) || null;
  if (!account) return null;

  const nextAccount: StoredAccount = {
    ...account,
    last_used_at: new Date().toISOString(),
  };
  const otherAccounts = listStoredAccounts().filter((candidate) => candidate.key !== accountKey);
  writeAccounts(sortAccounts([nextAccount, ...otherAccounts]));

  localStorage.setItem(ACTIVE_ACCOUNT_KEY, nextAccount.key);
  localStorage.setItem(TOKEN_KEY, nextAccount.token);
  localStorage.setItem(SERVER_URL_KEY, nextAccount.server_url);
  return nextAccount;
}

export function removeStoredAccount(accountKey: string): StoredAccount[] {
  const accounts = listStoredAccounts().filter((account) => account.key !== accountKey);
  writeAccounts(accounts);

  if (localStorage.getItem(ACTIVE_ACCOUNT_KEY) === accountKey) {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  return accounts;
}

export function clearActiveSessionToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}

export function removeActiveStoredAccount() {
  const activeKey = getActiveAccountKey();
  if (!activeKey) {
    clearActiveSessionToken();
    return;
  }
  removeStoredAccount(activeKey);
}
