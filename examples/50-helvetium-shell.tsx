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

function Shell({ children }: { children?: VNodeChild }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Helvetium shell</title>
        <style>{`
          :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
          body { margin: 0; }
          a { color: inherit; }
          .topbar, .footer { padding: 1rem 1.5rem; background: #20232a; color: white; }
          .topbar { display: flex; justify-content: space-between; gap: 1rem; }
          .topbar nav { display: flex; gap: 1rem; }
          .brand { font-weight: 700; text-decoration: none; }
          .layout { display: grid; grid-template-columns: 14rem 1fr; min-height: 70vh; }
          .sidebar { padding: 1.5rem; background: #eef0f4; color: #20232a; }
          .sidebar nav { display: grid; gap: .75rem; }
          .content { padding: 2rem; }
          .card { max-width: 42rem; padding: 1.5rem; border: 1px solid #aeb4c0; border-radius: .75rem; }
          @media (max-width: 640px) { .layout { grid-template-columns: 1fr; } }
        `}</style>
      </head>
      <body>
        <header class="topbar">
          <Anchor class="brand" to="/">
            Helvetium
          </Anchor>
          <nav aria-label="Primary">
            <Anchor to="/">Home</Anchor>
            <Anchor to="/reports">Reports</Anchor>
            <Anchor to="/settings">Settings</Anchor>
          </nav>
        </header>

        <div class="layout">
          <aside class="sidebar">
            <strong>Workspace</strong>
            <nav aria-label="Workspace">
              <Anchor to="/reports">View reports</Anchor>
              <Anchor to="/settings?tab=profile">Profile settings</Anchor>
            </nav>
          </aside>

          <main class="content" id="content">
            {children}
          </main>
        </div>

        <footer class="footer">Persistent shell footer</footer>
      </body>
    </html>
  );
}

function HomePage() {
  return (
    <section class="card">
      <h1>Application shell</h1>
      <p>The header, sidebar, and footer persist while the managed page content changes.</p>
      <Anchor to="/reports">Open reports</Anchor>
    </section>
  );
}

function ReportsPage() {
  return (
    <section class="card">
      <h1>Reports</h1>
      <ul>
        <li>Traffic: 12,480 visits</li>
        <li>Conversions: 8.4%</li>
        <li>Availability: 99.99%</li>
      </ul>
    </section>
  );
}

function SettingsPage() {
  return (
    <section class="card">
      <h1>Settings</h1>
      <p>This route was rendered inside the same persistent document shell.</p>
    </section>
  );
}

function NotFoundPage() {
  return (
    <section class="card">
      <h1>Page not found</h1>
      <Anchor to="/">Return home</Anchor>
    </section>
  );
}

const routes: HelvetiumRouteDefinition[] = [
  { id: 'home', path: '/', component: HomePage, title: 'Home' },
  { id: 'reports', path: '/reports', component: ReportsPage, title: 'Reports' },
  { id: 'settings', path: '/settings', component: SettingsPage, title: 'Settings' },
];

const app = createApp();
app.use(
  helvetiumPages(<Shell />, {
    routes,
    notFound: NotFoundPage,
    status: (router) => (router.match ? 200 : 404),
  }),
);

serve({ app, port: 3000 });
