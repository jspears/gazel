console.log('[renderer.ts] Loading from electron/renderer.ts');
console.log('[renderer.ts] window.location:', window.location.href);
console.log('[renderer.ts] document.title:', document.title);

import './client.ipc.js';
import {mount} from 'svelte';
import App from '../client/App.svelte';
import '../client/app.css';
mount(App, {
    target: document.getElementById('app')!,
});
