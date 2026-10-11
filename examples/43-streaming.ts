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
import { createApp, streamText } from '@newfoundcodes/helvetium-boot';

const app = createApp();
const stages = [
  { name: 'Reading application graph', delay: 350, result: '47 modules found' },
  { name: 'Compiling server bundle', delay: 700, result: 'bundle size: 184 kB' },
  { name: 'Rendering static routes', delay: 550, result: '12 pages rendered' },
  { name: 'Running health checks', delay: 450, result: 'all checks passed' },
];

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function* deploymentLog(project: string) {
  const startedAt = Date.now();
  yield `Starting simulated deployment for ${project}\n\n`;

  for (const [index, stage] of stages.entries()) {
    const progress = Math.round((index / stages.length) * 100);
    yield `[${String(progress).padStart(3)}%] ${stage.name}...\n`;

    await wait(stage.delay);
    yield `       ✓ ${stage.result}\n`;
  }

  yield `[100%] Deployment ready in ${Date.now() - startedAt} ms\n`;
}

app.get('/stream', (c) => {
  const project = (c.req.query('project') ?? 'helvetium-app')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 40);
  return c.stream(streamText(deploymentLog(project)), 200, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  });
});

const server = serve({ app, port: Number(process.env.PORT ?? 3000) });
const url = await server.ready;

console.log(`Streaming example: ${url}/stream?project=helvetium`);
