import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useNocloudStore } from './stores/nocloud.ts';
import './style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.mount('#app');

void useNocloudStore().init();
