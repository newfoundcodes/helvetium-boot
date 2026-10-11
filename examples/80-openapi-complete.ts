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
  validator,
} from '@newfoundcodes/helvetium-boot';

const app = createApp();

const UserInput = schema.object({
  email: schema.string({ format: 'email' }),
  displayName: schema.string({ min: 2, max: 80 }),
});

const User = componentSchema(
  'User',
  schema.object({
    id: schema.string(),
    email: schema.string({ format: 'email' }),
    displayName: schema.string(),
  }),
);

app.post(
  '/users',
  describeRoute({
    operationId: 'createUser',
    summary: 'Create a user',
    description: 'Creates a new user and returns its public representation.',
    tags: ['users'],
    security: [{ bearerAuth: ['users:write'] }],
    responses: {
      201: {
        description: 'Created user',
        headers: {
          location: {
            description: 'Canonical resource URL',
            schema: { type: 'string', format: 'uri-reference' },
          },
        },
        content: { 'application/json': { schema: User } },
      },
      400: { description: 'Invalid input' },
      401: { description: 'Authentication required' },
    },
    'x-owner': 'identity-team',
  }),
  validator('json', UserInput),
  (c) => c.json({ id: 'u_123', email: 'person@example.com', displayName: 'Person' }, 201),
);

app.get(
  '/openapi.json',
  openAPIRouteHandler(app, {
    pretty: 2,
    cacheControl: 'public, max-age=60',
    documentation: {
      info: {
        title: 'Users API',
        version: '1.0.0',
        description: 'Complete Helvetium Boot OpenAPI example.',
        contact: { name: 'API Team', email: 'api@example.com' },
        license: { name: 'MIT', identifier: 'MIT' },
      },
      servers: [{ url: 'https://api.example.com', description: 'Production' }],
      tags: [{ name: 'users', description: 'User lifecycle operations' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  }),
);

serve({ app, port: 3000 });
