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
import { Anchor, useLocation, type VNodeChild } from '@newfoundcodes/helvetium-dom';

const basePath = '/console';

function ConsoleShell({ children }: { children?: VNodeChild }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Helvetium console</title>
        <style>{`
          :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
          body { margin: 0; background: #f5f7fb; color: #172033; }
          header { padding: 1rem 1.5rem; background: #172033; color: white; }
          nav { display: flex; align-items: center; gap: 1rem; }
          nav a { color: inherit; }
          .brand { margin-right: auto; font-weight: 750; text-decoration: none; }
          main { max-width: 50rem; margin: 2rem auto; padding: 0 1rem; }
          .card { padding: 1.5rem; border: 1px solid #d4d9e2; border-radius: .75rem; background: white; }
          .path { padding: .15rem .4rem; border-radius: .25rem; background: #e8ebf2; font-family: ui-monospace, monospace; }
          @media (prefers-color-scheme: dark) {
            body { background: #101522; color: #edf1f8; }
            .card { border-color: #374055; background: #1a2233; }
            .path { background: #30394d; }
          }
        `}</style>
      </head>
      <body>
        <header>
          <nav aria-label="Console">
            <Anchor class="brand" to="/">
              Helvetium Console
            </Anchor>
            <Anchor to="/">Dashboard</Anchor>
            <Anchor to="/reports">Reports</Anchor>
            <Anchor to="/settings?tab=profile">Settings</Anchor>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

function Dashboard() {
  return (
    <section class="card">
      <h1>Dashboard</h1>
      <p>
        This application lives at <span class="path">{basePath}</span>, while its routes stay
        relative to that base path.
      </p>
      <Anchor to="/reports">Open the reports route</Anchor>
    </section>
  );
}

function ReportsPage() {
  return (
    <section class="card">
      <h1>Reports</h1>
      <p>The router resolved this page from the relative route /reports.</p>
      <p>The browser-facing URL is /console/reports.</p>
    </section>
  );
}

function SettingsPage() {
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get('tab') ?? 'general';
  return (
    <section class="card">
      <h1>Settings</h1>
      <p>Active tab: {activeTab}</p>
      <p>Query strings are preserved when a base path is applied.</p>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section class="card">
      <h1>Console page not found</h1>
      <Anchor to="/">Return to the dashboard</Anchor>
    </section>
  );
}

const routes: HelvetiumRouteDefinition[] = [
  { id: 'dashboard', path: '/', component: Dashboard, title: 'Dashboard' },
  { id: 'reports', path: '/reports', component: ReportsPage, title: 'Reports' },
  { id: 'settings', path: '/settings', component: SettingsPage, title: 'Settings' },
];

const app = createApp();
app.get('/', (context) => context.redirect(basePath));

app.use(
  basePath,
  helvetiumPages(<ConsoleShell />, {
    routes,
    basePath,
    notFound: NotFoundPage,
    status: (router) => (router.match ? 200 : 404),
  }),
);

serve({ app, port: 3000 });
