<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useNocloudStore } from '../stores/nocloud.ts';

const store = useNocloudStore();
const { logs } = storeToRefs(store);
</script>

<template>
  <fieldset class="panel">
    <legend>Логи</legend>
    <p class="tagline">
      Сессия, ICE и ошибки. Файл app.log лежит в OPFS этого устройства.
    </p>
    <p v-if="logs.error" class="error" role="alert">{{ logs.error }}</p>
    <pre class="resolved logs-body" aria-label="Журнал приложения">{{
      logs.text || 'Пока пусто'
    }}</pre>
  </fieldset>
</template>
