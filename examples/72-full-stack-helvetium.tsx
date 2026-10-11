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
import { Anchor, type VNodeChild } from '@newfoundcodes/helvetium-dom';

function Navbar() {
  return (
    <nav>
      <Anchor to="/">Home</Anchor>
      {' | '}
      <Anchor to="/users/42">User 42</Anchor>
    </nav>
  );
}

function Footer() {
  return <footer>Powered by Helvetium</footer>;
}

function Index({ children }: { children?: VNodeChild }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Hello, world!</title>
      </head>
      <body>
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}

const Home = () => (
  <main>
    <h1>Home</h1>
    <Anchor to="/users/42">User 42</Anchor>
  </main>
);

const User = (props: Record<string, unknown>) => {
  const params = props.params;
  const id =
    typeof params === 'object' && params !== null && 'id' in params ? String(params.id) : '';
  return (
    <main>
      <h1>User {id}</h1>
      <Anchor to="/">Home</Anchor>
    </main>
  );
};

const routes: HelvetiumRouteDefinition[] = [
  { id: 'home', path: '/', component: Home },
  { id: 'user', path: '/users/:id', component: User },
];

const app = createApp();
app.get('/api/health', (c) => c.json({ ok: true }));

app.use(helvetiumPages(<Index />, { routes }));

serve({ app, port: 3000 });
