
import './client.ipc.js';

import {mount} from 'svelte';
import App from '../client/App.svelte';
import '../client/app.css';
mount(App, {
    target: document.getElementById('app')!,
});
