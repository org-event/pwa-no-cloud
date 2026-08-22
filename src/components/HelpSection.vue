<script setup lang="ts">
import { HELP_TOPICS } from '../content/help-topics.ts';
</script>

<template>
  <fieldset class="panel">
    <legend>Справка</legend>
    <p class="tagline">
      Коротко по разделам меню и кнопкам. Ссылки внутри открывают нужный экран.
    </p>
  </fieldset>

  <fieldset
    v-for="topic in HELP_TOPICS"
    :id="`help-${topic.id}`"
    :key="topic.id"
    class="panel"
  >
    <legend>
      <a v-if="topic.href" :href="topic.href">{{ topic.title }}</a>
      <template v-else>{{ topic.title }}</template>
    </legend>
    <p class="tagline">{{ topic.lead }}</p>
    <dl class="help-list">
      <template v-for="item in topic.items" :key="item.name">
        <dt>{{ item.name }}</dt>
        <dd>{{ item.text }}</dd>
      </template>
    </dl>
  </fieldset>
</template>
