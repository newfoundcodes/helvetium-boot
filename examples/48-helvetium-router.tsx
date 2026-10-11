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

import { createApp } from '@newfoundcodes/helvetium-boot';
import {
  helvetiumPages,
  type HelvetiumRouteDefinition,
} from '@newfoundcodes/helvetium-boot/helvetium-dom';
import { serve } from '@newfoundcodes/helvetium-boot/node';
import { Anchor, RouterOutlet, RouterProvider, Router } from '@newfoundcodes/helvetium-dom';

function Home() {
  return (
    <main>
      <h1>Home</h1>
      <Anchor to="/about">About</Anchor>
    </main>
  );
}

function About() {
  return (
    <main>
      <h1>About</h1>
      <Anchor to="/">Home</Anchor>
    </main>
  );
}

const routes: HelvetiumRouteDefinition[] = [
  { id: 'home', path: '/', component: Home },
  { id: 'about', path: '/about', component: About },
];

export function App({ router }: { router: Router }) {
  return (
    <RouterProvider router={router}>
      <nav>
        <Anchor to="/">Home</Anchor>
      </nav>
      <RouterOutlet />
    </RouterProvider>
  );
}

const app = createApp();
app.use(helvetiumPages({ routes }));

serve({ app, port: 3000 });
