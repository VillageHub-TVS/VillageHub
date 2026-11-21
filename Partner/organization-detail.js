import { mountSidebar } from './sidebar.js';

mountSidebar();

const action = document.createElement('a');
action.href = '/edit-organizations';
action.className = 'organization-edit-action';
action.textContent = 'Edit organization detail';

const actionStyles = document.createElement('style');
actionStyles.textContent = `
  .organization-edit-action {
    display: inline-block;
    margin-top: 20px;
    padding: 9px 12px;
    border: 1px solid #d5e0d8;
    border-radius: 6px;
    color: #126d5e;
    text-decoration: none;
  }
  .organization-edit-action:hover {
    background: #e5eee7;
  }
`;

document.head.append(actionStyles);
document.querySelector('#page-content')?.append(action);