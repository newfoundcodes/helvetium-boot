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
import {
  createApp,
  describeRoute,
  openAPIRouteHandler,
  schema,
  validator,
} from '@newfoundcodes/helvetium-boot';

const app = createApp();

const Params = schema.object({ id: schema.string({ pattern: /^[a-f0-9-]+$/ }) });
const Query = schema.object({ include: schema.enum(['profile', 'roles'] as const).optional() });
const Body = schema.object({ displayName: schema.string({ min: 2, max: 80 }) });

app.patch(
  '/users/:id',
  describeRoute({
    operationId: 'updateUser',
    summary: 'Update one user',
    tags: ['users'],
    responses: { 200: { description: 'Updated user' }, 404: { description: 'User not found' } },
  }),
  validator('param', Params),
  validator('query', Query),
  validator('json', Body),
  (c) => c.json({ id: c.req.valid<typeof Params>('param') }),
);

app.get(
  '/openapi.json',
  openAPIRouteHandler(app, {
    info: { title: 'Validator Inference', version: '1.0.0' },
    pretty: 2,
  }),
);

serve({ app, port: 3000 });
