import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const routes = {
  '/overview': { page: 'overview', title: 'Overview' },
  '/calendar': { page: 'calendar', title: 'Calendar' },
  '/edit-date': { page: 'edit-date', title: 'Edit hours and location' },
  '/weekly-operation-hours': { page: 'weekly-operation-hours', title: 'Weekly operating hours' },
  '/inbox': { page: 'inbox', title: 'Inbox' },
  '/organization-detail': { page: 'organization-detail', title: 'Organization' },
  '/edit-organizations': { page: 'edit-organizations', title: 'Edit organization detail' },
  '/create-account': { page: 'create-account', title: 'Create account' },
  '/set-operating-hours': { page: 'set-operating-hours', title: 'Set operating hours' },
  '/login': { page: 'login', title: 'Log in' },
};
const scripts = new Set([
  'sidebar.js',
  'overview.js',
  'calendar.js',
  'edit-date.js',
  'weekly-operation-hours.js',
  'inbox.js',
  'organization-detail.js',
  'edit-organizations.js',
  'login.js',
  'create-account.js',
  'set-operating-hours.js',
]);

function sendPage(res, route) {
  const isStandalone = ['login', 'create-account', 'set-operating-hours'].includes(route.page);
  const sidebar = isStandalone ? '' : '<aside class="sidebar" id="sidebar"></aside>';
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${route.title} | Partner portal</title>
  </head>
  <body data-page="${route.page}">
    <div class="app-shell">
      ${sidebar}
      <main class="page-content" id="page-content"></main>
    </div>
    <script type="module" src="/${route.page}.js"></script>
  </body>
</html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { Allow: 'GET' });
    res.end('Method not allowed');
    return;
  }

  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') {
    res.writeHead(302, { Location: '/overview' });
    res.end();
    return;
  }

  const route = routes[pathname];
  if (route) {
    sendPage(res, route);
    return;
  }

  const filename = path.basename(pathname);
  if (!scripts.has(filename) || pathname !== `/${filename}`) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  fs.readFile(path.join(directory, filename), (error, source) => {
    if (error) {
      console.error(`Unable to serve ${filename}:`, error.message);
      res.writeHead(500);
      res.end('Unable to load page script');
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    res.end(source);
  });
}).listen(port, () => {
  console.log(`Partner portal running at http://localhost:${port}`);
});
