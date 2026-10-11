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

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import type {
  GenerateStaticSiteOptions,
  StaticPageResult,
  StaticSiteApp,
} from '../interfaces/ssg.js';

function outputFile(outDir: string, route: string, cleanUrls: boolean): string {
  const pathname = new URL(route, 'http://localhost').pathname;
  if (pathname === '/') {
    return join(outDir, 'index.html');
  }

  const relative = pathname.replace(/^\/+/, '');
  if (extname(relative)) {
    return join(outDir, relative);
  }

  return cleanUrls ? join(outDir, `${relative}.html`) : join(outDir, relative, 'index.html');
}

export async function generateStaticSite(
  app: StaticSiteApp,
  options: GenerateStaticSiteOptions,
): Promise<StaticPageResult[]> {
  const outDir = options.outDir ?? 'site';
  const origin = options.origin ?? 'http://localhost';
  const cleanUrls = options.cleanUrls ?? false;
  const results: StaticPageResult[] = [];

  for (const route of options.routes) {
    const request = new Request(new URL(route, origin), { headers: options.headers });
    const response = await app.fetch(request);

    if (!response.ok) {
      throw new Error(`Static generation failed for ${route}: HTTP ${response.status}`);
    }

    const body = new Uint8Array(await response.arrayBuffer());
    const file = outputFile(outDir, route, cleanUrls);

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);

    const result: StaticPageResult = {
      route,
      file,
      status: response.status,
      contentType: response.headers.get('content-type'),
      bytes: body.byteLength,
    };

    results.push(result);
    await options.onPage?.(result);
  }

  return results;
}
