import './app.css';
import App from './App.svelte';

console.log('Booting %s', process.env.VITE_ELECTRON ? 'Electron' : 'Web');

const app = new App({
  target: document.getElementById('app')!,
});

export default app;
