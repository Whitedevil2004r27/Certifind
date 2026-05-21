import { neon, neonConfig } from '@neondatabase/serverless';
import * as dns from 'node:dns';
import type { IncomingHttpHeaders } from 'node:http';
import { Resolver } from 'node:dns/promises';
import * as https from 'node:https';

if (typeof window === 'undefined') {
  try {
    neonConfig.fetchFunction = createNeonDnsFetch();
  } catch (e) {
    console.warn('Failed to configure client Neon DNS fallback:', e);
  }
}

function createNeonDnsFetch() {
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

  return async function neonDnsFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const target = new URL(request ? request.url : input.toString());
    const headers = new Headers(request?.headers);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const body =
      init.body !== undefined
        ? init.body
        : request
          ? Buffer.from(await request.arrayBuffer())
          : undefined;

    return new Promise<Response>((resolve, reject) => {
      const req = https.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method: init.method || request?.method || 'GET',
          headers: Object.fromEntries(headers),
          lookup(hostname, options, callback) {
            resolver
              .resolve4(hostname)
              .then((addresses) => {
                if (!addresses.length) {
                  throw new Error(`No A records found for ${hostname}`);
                }

                if (options?.all) {
                  callback(
                    null,
                    addresses.map((address) => ({ address, family: 4 }))
                  );
                  return;
                }

                callback(null, addresses[0], 4);
              })
              .catch(() => {
                (dns.lookup as any)(hostname, options, callback);
              });
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => {
            resolve(
              new Response(Buffer.concat(chunks), {
                status: res.statusCode || 500,
                statusText: res.statusMessage,
                headers: toResponseHeaders(res.headers),
              })
            );
          });
        }
      );

      req.on('error', reject);
      if (body) req.write(body as any);
      req.end();
    });
  };
}

function toResponseHeaders(headers: IncomingHttpHeaders) {
  const responseHeaders = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => responseHeaders.append(key, entry));
    } else if (value !== undefined) {
      responseHeaders.set(key, String(value));
    }
  });

  return responseHeaders;
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
