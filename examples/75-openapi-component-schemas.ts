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
  componentSchema,
  createApp,
  describeRoute,
  openAPIRouteHandler,
  schema,
} from '@newfoundcodes/helvetium-boot';

const app = createApp();

const User = componentSchema(
  'User',
  schema.object({
    id: schema.string().describe('Stable user identifier'),
    email: schema.string({ format: 'email' }),
    active: schema.boolean(),
  }),
);

app.get(
  '/users/:id',
  describeRoute({
    operationId: 'getUser',
    responses: {
      200: {
        description: 'User',
        content: { 'application/json': { schema: User } },
      },
      404: { description: 'User not found' },
    },
  }),
  (c) => c.json({ id: c.req.param('id'), email: 'user@example.com', active: true }),
);

app.get(
  '/openapi.json',
  openAPIRouteHandler(app, {
    info: { title: 'Component Schemas', version: '1.0.0' },
    pretty: 2,
  }),
);

serve({ app, port: 3000 });
