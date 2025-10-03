console.log('Mounting app', import.meta.env.VITE_ELECTRON ? 'in Electron' : 'in browser');
import {mount} from 'svelte';
import App from './App.svelte';
import './app.css';
mount(App, {
    target: document.getElementById('app')!,
});
