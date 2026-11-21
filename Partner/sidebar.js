const styles = `
  :root {
    color: #23332e;
    background: #fff;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
  }
  * { box-sizing: border-box; }
  body { min-width: 320px; min-height: 100vh; margin: 0; }
  .app-shell { min-height: 100vh; }
  .sidebar {
    position: fixed; inset: 0 auto 0 0; display: flex; width: 256px;
    flex-direction: column; padding: 18px 16px 14px;
    border-right: 1px solid #e8ece8; background: #fff;
  }
  .brand {
    display: flex; align-items: center; gap: 9px; min-height: 28px;
    color: #173a32; font-size: 13px; font-weight: 700; text-decoration: none;
  }
  .brand-mark {
    display: grid; width: 26px; height: 28px; place-items: center;
    border-radius: 6px; background: #f7e889; color: #17786c;
    font-size: 15px; font-weight: 800;
  }
  .organization-card {
    display: flex; flex-direction: column; gap: 5px; margin-top: 20px;
    padding: 11px 9px; border-radius: 9px; background: #f5f7f1;
  }
  .organization-card strong { max-width: 185px; color: #263d36; font-size: 11px; line-height: 1.35; }
  .organization-card span { color: #7a8982; font-size: 10px; }
  .navigation { display: grid; gap: 3px; margin-top: 19px; }
  .nav-link {
    display: flex; min-height: 36px; align-items: center; gap: 10px;
    padding: 0 9px; border-radius: 7px; color: #586b64;
    font-size: 12px; text-decoration: none;
  }
  .nav-link svg {
    width: 15px; height: 15px; flex: none; fill: none; stroke: currentColor;
    stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8;
  }
  .nav-link:hover, .nav-link.active { background: #e5eee7; color: #126d5e; }
  .nav-link.active { font-weight: 650; }
  .sidebar-footer { display: grid; gap: 10px; margin-top: auto; color: #718078; font-size: 9px; }
  .sidebar-footer strong { color: #28443a; font-size: 10px; }
  .logout-link { width: fit-content; color: #087762; font-size: 10px; font-weight: 700; text-decoration: none; }
  .logout-link:hover { text-decoration: underline; }
  .page-content { min-height: 100vh; margin-left: 256px; padding: 32px; background: #fbfcfa; }
  .page-content h1 { margin: 0; color: #20362e; font-size: 24px; }
  .login-page { display: grid; min-height: 100vh; place-items: center; padding: 24px; background: #f7f9f6; }
  .login-card { width: min(100%, 380px); padding: 30px; border: 1px solid #e5eae4; border-radius: 12px; background: #fff; }
  .login-card h1 { margin: 20px 0 0; color: #20362e; font-size: 24px; }
  .login-card-actions { display: grid; gap: 10px; margin-top: 20px; }
  .login-card-actions a {
    display: block; padding: 9px 12px; border: 1px solid #d5e0d8;
    border-radius: 6px; color: #126d5e; text-align: center; text-decoration: none;
  }
  .login-card-actions a:hover { background: #e5eee7; }
  @media (max-width: 600px) {
    .sidebar { width: 210px; padding-right: 12px; padding-left: 12px; }
    .page-content { margin-left: 210px; padding: 24px 18px; }
  }
`;

const icons = {
  overview: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5v9a.5.5 0 0 1-.5.5H4.5a.5.5 0 0 1-.5-.5z"/><path d="M9 20v-6h6v6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 4v4m8-4v4M4 10h16"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M4 13h4l2 3h4l2-3h4M8 9l3 2 5-4"/></svg>',
  organization: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/></svg>',
};

const links = [
  { page: 'overview', label: 'Overview', href: '/overview' },
  { page: 'calendar', label: 'Calendar', href: '/calendar' },
  { page: 'inbox', label: 'Inbox', href: '/inbox' },
  { page: 'organization-detail', label: 'Organization', href: '/organization-detail' },
];

const pageTitles = {
  'edit-date': 'Edit hours and location',
  'weekly-operation-hours': 'Weekly operating hours',
  'edit-organizations': 'Edit organization detail',
};

function addStyles() {
  const style = document.createElement('style');
  style.textContent = styles;
  document.head.append(style);
}

export function mountSidebar() {
  addStyles();
  const sidebar = document.querySelector('#sidebar');
  const content = document.querySelector('#page-content');
  if (!sidebar || !content) return;

  const currentPage = document.body.dataset.page;
  const activePage = {
    'edit-date': 'calendar',
    'weekly-operation-hours': 'calendar',
    'edit-organizations': 'organization-detail',
  }[currentPage] ?? currentPage;
  const navigation = links
    .map(({ page, label, href }) => {
      const active = page === activePage;
      const icon = page === 'organization-detail' ? icons.organization : icons[page];
      return `<a class="nav-link${active ? ' active' : ''}" href="${href}"${active ? ' aria-current="page"' : ''}>
        ${icon}<span>${label}</span>
      </a>`;
    })
    .join('');

  sidebar.innerHTML = `
    <a class="brand" href="/overview">
      <span class="brand-mark" aria-hidden="true">P</span><span>Partner portal</span>
    </a>
    <section class="organization-card" aria-label="Current organization">
      <strong>Community Support Network</strong><span>Community organization</span>
    </section>
    <nav class="navigation" aria-label="Main navigation">${navigation}</nav>
    <footer class="sidebar-footer">
      <span>Pacific Time · Los Angeles</span>
      <strong>Community Support Network</strong>
      <span>partner@example.com</span>
      <a class="logout-link" href="/login">Log out</a>
    </footer>
  `;
  const title = pageTitles[currentPage] ?? links.find((link) => link.page === currentPage)?.label ?? 'Overview';
  content.innerHTML = `<h1>${title}</h1>`;
}

function mountFlowPage(title, actions = []) {
  addStyles();
  const content = document.querySelector('#page-content');
  if (!content) return;

  content.className = 'login-page';
  const card = document.createElement('section');
  card.className = 'login-card';

  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = '/overview';
  brand.innerHTML = '<span class="brand-mark" aria-hidden="true">P</span><span>Partner portal</span>';

  const heading = document.createElement('h1');
  heading.textContent = title;
  card.append(brand, heading);

  if (actions.length) {
    const actionList = document.createElement('div');
    actionList.className = 'login-card-actions';
    for (const { label, href } of actions) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      actionList.append(link);
    }
    card.append(actionList);
  }

  content.replaceChildren(card);
}

export function mountLogin() {
  mountFlowPage('Log in', [{ label: 'Sign up', href: '/create-account' }]);
}

export function mountCreateAccount() {
  mountFlowPage('Create account', [
    { label: 'Log in', href: '/login' },
    { label: 'Continue to set regular operating hours', href: '/set-operating-hours' },
  ]);
}

export function mountOperatingHours() {
  mountFlowPage('Set operating hours');
}
