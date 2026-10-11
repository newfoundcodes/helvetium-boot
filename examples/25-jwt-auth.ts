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
import { createApp, jwtAuth, signJWT } from '@newfoundcodes/helvetium-boot';

const secret = 'replace-this-with-a-long-random-secret';
const token = await signJWT({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);
const app = createApp();

app.use('/me', jwtAuth({ key: secret, algorithms: ['HS256'] }));
app.get('/me', (c) => c.json(c.get('jwtPayload')));

console.log(`Token: ${token}`);

// Use the token to verify if it works:
// curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/

serve({ app, port: 3000 });
