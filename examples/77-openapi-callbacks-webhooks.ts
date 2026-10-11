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
import { createApp, describeRoute, generateOpenAPI } from '@newfoundcodes/helvetium-boot';

const app = createApp();

app.post(
  '/subscriptions',
  describeRoute({
    operationId: 'createSubscription',
    callbacks: {
      eventDelivery: {
        '{$request.body#/callbackUrl}': {
          post: {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: { 200: { description: 'Callback accepted' } },
          },
        },
      },
    },
    responses: { 202: { description: 'Subscription accepted' } },
  }),
  (c) => c.json({ accepted: true }, 202),
);

export const document = generateOpenAPI(app, {
  documentation: {
    info: { title: 'Event API', version: '1.0.0' },
    webhooks: {
      accountDeleted: {
        post: { responses: { 204: { description: 'Webhook processed' } } },
      },
    },
  },
});

app.get('/openapi.json', (c) => c.json(document));

serve({ app, port: 3000 });
