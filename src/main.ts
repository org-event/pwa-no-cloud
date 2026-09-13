import { createApp } from 'vue';
import { vaporInteropPlugin } from '@vue/runtime-vapor';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useNocloudStore } from './stores/nocloud.ts';
import { initTheme } from './lib/theme.ts';
import './style.css';

initTheme();

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
// Hybrid VDOM shell + Vapor leaf SFCs (`script setup vapor`).
app.use(vaporInteropPlugin);
app.mount('#app');

void useNocloudStore().init();
