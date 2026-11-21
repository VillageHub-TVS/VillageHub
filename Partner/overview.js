import { mountSidebar } from './sidebar.js';

mountSidebar();

const actions = document.createElement('div');
actions.className = 'overview-actions';
actions.innerHTML = `
  <a href="/calendar">Go to calendar</a>
  <a href="/inbox">Go to inbox</a>
  <a href="/organization-detail">View organization detail</a>
`;

const actionStyles = document.createElement('style');
actionStyles.textContent = `
  .overview-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 20px;
  }
  .overview-actions a {
    padding: 9px 12px;
    border: 1px solid #d5e0d8;
    border-radius: 6px;
    color: #126d5e;
    text-decoration: none;
  }
  .overview-actions a:hover {
    background: #e5eee7;
  }
`;

document.head.append(actionStyles);
document.querySelector('#page-content')?.append(actions);