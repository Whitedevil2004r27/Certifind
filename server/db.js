const { neon, neonConfig } = require('@neondatabase/serverless');
const dns = require('dns');
const https = require('https');
const { Resolver } = require('dns').promises;
require('dotenv').config();

function createNeonDnsFetch() {
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

  return async function neonDnsFetch(input, init = {}) {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const target = new URL(request ? request.url : input.toString());
    const headers = new Headers(request ? request.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const body =
      init.body !== undefined
        ? init.body
        : request
          ? Buffer.from(await request.arrayBuffer())
          : undefined;

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method: init.method || (request && request.method) || 'GET',
          headers: Object.fromEntries(headers),
          lookup(hostname, options, callback) {
            resolver
              .resolve4(hostname)
              .then((addresses) => {
                if (!addresses.length) {
                  throw new Error(`No A records found for ${hostname}`);
                }

                if (options && options.all) {
                  callback(
                    null,
                    addresses.map((address) => ({ address, family: 4 }))
                  );
                  return;
                }

                callback(null, addresses[0], 4);
              })
              .catch(() => {
                dns.lookup(hostname, options, callback);
              });
          },
        },
        (res) => {
          const chunks = [];
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
      if (body) req.write(body);
      req.end();
    });
  };
}

function toResponseHeaders(headers) {
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

neonConfig.fetchFunction = createNeonDnsFetch();

const databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl) {
  console.warn('WARNING: Missing DATABASE_URL in server environment.');
}

const sql = neon(databaseUrl);

module.exports = sql;
