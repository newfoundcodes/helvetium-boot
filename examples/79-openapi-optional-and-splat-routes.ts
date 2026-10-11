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
import { createApp, describeRoute, openAPIRouteHandler } from '@newfoundcodes/helvetium-boot';

const app = createApp();

app.get(
  '/reports/:year?',
  describeRoute({
    operationId: 'getReports',
    responses: { 200: { description: 'Reports' } },
  }),
  (c) => c.json({ year: c.req.param('year') ?? null }),
);

app.get(
  '/files/*path',
  describeRoute({
    operationId: 'getFile',
    responses: { 200: { description: 'File content' } },
  }),
  (c) => c.text(c.req.param('path') ?? ''),
);

app.get(
  '/openapi.json',
  openAPIRouteHandler(app, {
    info: { title: 'Optional and Splat Routes', version: '1.0.0' },
    pretty: 2,
  }),
);

serve({ app, port: 3000 });
