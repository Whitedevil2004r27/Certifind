import { neon } from '@neondatabase/serverless';
import * as dns from 'node:dns';

if (typeof window === 'undefined') {
  try {
    const mutableDns = dns as any;
    mutableDns.setServers(['8.8.8.8', '8.8.4.4']);
    const originalLookup = mutableDns.lookup;
    mutableDns.lookup = function (hostname: string, options: any, callback: any) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (hostname && hostname.endsWith('neon.tech')) {
        dns.resolve(hostname, (err: any, addresses: string[]) => {
          if (err || !addresses || !addresses.length) {
            return originalLookup(hostname, options, callback);
          }
          callback(null, addresses[0], 4);
        });
      } else {
        originalLookup(hostname, options, callback);
      }
    };
    console.log('🌐 Client DNS Lookup monkey-patched to bypass local resolution issues for neon.tech');
  } catch (e) {
    console.warn('⚠️ Failed to configure client DNS monkey-patch:', e);
  }
}

type NeonSqlClient = ReturnType<typeof neon>;

let sqlClient: NeonSqlClient | null = null;
let sqlClientUrl: string | null = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
  }

  if (!sqlClient || sqlClientUrl !== databaseUrl) {
    sqlClient = neon(databaseUrl);
    sqlClientUrl = databaseUrl;
  }

  return sqlClient;
}

export const sql = {
  query(text: string, params: unknown[] = []) {
    return getSqlClient().query(text, params);
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|timeout|ECONNRESET|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(message);
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return (await getSqlClient().query(text, params)) as T[];
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === 2) break;
      await sleep(350 * (attempt + 1));
    }
  }

  throw lastError;
}
