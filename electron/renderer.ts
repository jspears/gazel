import {mount} from 'svelte';
import '../client/client.ipc';
import App from '../client/App.svelte';
import '../client/app.css';
mount(App, {
    target: document.getElementById('app')!,
});
