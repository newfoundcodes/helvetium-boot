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
import { Anchor, useLocation, useParams, type VNodeChild } from '@newfoundcodes/helvetium-dom';

function Navigation() {
  return (
    <nav aria-label="Primary">
      <Anchor to="/">Home</Anchor>
      {' | '}
      <Anchor to="/projects">Projects</Anchor>
      {' | '}
      <Anchor to="/users/42?tab=security#sessions">User security</Anchor>
      {' | '}
      <Anchor to="https://example.com">External</Anchor>
    </nav>
  );
}

function Index({ children }: { children?: VNodeChild }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Anchor deep links</title>
      </head>
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}

function HomePage() {
  return (
    <main>
      <h1>Home</h1>
      <p>Every internal anchor supports direct requests and same-document navigation.</p>
    </main>
  );
}

function ProjectsPage() {
  return (
    <main>
      <h1>Projects</h1>
      <Anchor to="/users/7?tab=activity#sessions">Open user 7 activity</Anchor>
    </main>
  );
}

function UserPage() {
  const params = useParams();
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab') ?? 'overview';
  return (
    <main>
      <h1>User {params.id}</h1>
      <p>Active tab: {tab}</p>
      <section id="sessions">
        <h2>Sessions</h2>
        <p>The URL fragment scrolls to this section in a browser.</p>
      </section>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <Anchor to="/">Return home</Anchor>
    </main>
  );
}

const routes: HelvetiumRouteDefinition[] = [
  { id: 'home', path: '/', component: HomePage, title: 'Home' },
  { id: 'projects', path: '/projects', component: ProjectsPage, title: 'Projects' },
  { id: 'user', path: '/users/:id', component: UserPage, title: 'User' },
];

const app = createApp();
app.use(
  helvetiumPages(<Index />, {
    routes,
    notFound: NotFoundPage,
    status: (router) => (router.match ? 200 : 404),
  }),
);

serve({ app, port: 3000 });
