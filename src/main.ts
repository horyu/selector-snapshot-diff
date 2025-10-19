import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';

function showWarningIfNecessary(root: HTMLElement | null) {
  const template = document.getElementById('file-protocol-warning');
  if (!root || !(template instanceof HTMLTemplateElement)) return;
  const clone = template.content.cloneNode(true);
  root.replaceWith(clone);
}

const appRoot = document.getElementById('app');
let app: ReturnType<typeof mount> | null = null;

if (!import.meta.env?.DEV || !appRoot) {
  showWarningIfNecessary(appRoot);
} else {
  app = mount(App, { target: appRoot });
}

export default app;
