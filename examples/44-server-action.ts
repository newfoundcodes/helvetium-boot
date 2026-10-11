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
  serverAction,
  getServerActionId,
  serverActions,
  createApp,
} from '@newfoundcodes/helvetium-boot';

const createUser = serverAction(
  async function createUser(name: unknown) {
    'use server';
    if (typeof name !== 'string') {
      throw new TypeError('Expected a string name');
    }

    return { id: crypto.randomUUID(), name };
  },
  { id: 'create-user' },
);

const app = createApp();
app.use(serverActions());

const actionId = getServerActionId(createUser);
const server = serve({ app, port: Number(process.env.PORT ?? 3000) });
const url = await server.ready;

console.log(`Server action: ${url}/__helvetium/actions/${actionId}`);
