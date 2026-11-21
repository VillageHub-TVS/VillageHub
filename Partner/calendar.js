import { mountSidebar } from './sidebar.js';

mountSidebar();

const actions = document.createElement('div');
actions.className = 'calendar-actions';
actions.innerHTML = `
  <a href="/edit-date">Edit hours and location</a>
  <a href="/weekly-operation-hours">Manage weekly hours</a>
`;

const actionStyles = document.createElement('style');
actionStyles.textContent = `
  .calendar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 20px;
  }
  .calendar-actions a {
    padding: 9px 12px;
    border: 1px solid #d5e0d8;
    border-radius: 6px;
    color: #126d5e;
    text-decoration: none;
  }
  .calendar-actions a:hover {
    background: #e5eee7;
  }
`;

document.head.append(actionStyles);
document.querySelector('#page-content')?.append(actions);