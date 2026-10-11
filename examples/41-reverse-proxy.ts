/*
 * Helvetium Boot - Helvetium Framework, A Newfoundcodes project.
 *
 * Copyright (C) 2026 Jonathan Eldy Baldivicio
 *
 * Author: Jonathan Eldy Baldivicio
 * Contact: jonathaneldy.baldivicio@newfoundcodes.com
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { serve } from '@newfoundcodes/helvetium-boot/node';
import { createApp, proxy } from '@newfoundcodes/helvetium-boot';

const upstreamOrigin = 'http://127.0.0.1:3001';

const upstreamApp = createApp();
upstreamApp.all('/*path', async (c) => {
  const url = new URL(c.request.url);
  const body = ['GET', 'HEAD'].includes(c.request.method) ? null : await c.req.text();
  return c.json({
    method: c.request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    proxyTestHeader: c.req.header('x-proxy-test') ?? null,
    body,
  });
});

const proxyApp = createApp();
proxyApp.all('/upstream/*path', (c) =>
  proxy(upstreamOrigin, c.request, {
    rewritePath: (path) => path.slice('/upstream'.length) || '/',
  }),
);

const upstreamServer = serve({ app: upstreamApp, port: 3001 });
const proxyServer = serve({ app: proxyApp, port: 3000 });
const [upstreamUrl, proxyUrl] = await Promise.all([upstreamServer.ready, proxyServer.ready]);

console.log(`Upstream server: ${upstreamUrl}`);
console.log(`Reverse proxy:   ${proxyUrl}/upstream/*`);
