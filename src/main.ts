import { mount } from 'svelte';
import App from './App.svelte';
import './ui/styles/global.css';
import { registerServiceWorker } from './pwa/register';

const target = document.getElementById('app');
if (!target) throw new Error('Không tìm thấy phần tử #app');

const app = mount(App, { target });

registerServiceWorker();

export default app;
