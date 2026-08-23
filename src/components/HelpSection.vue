<script setup lang="ts">
import { HELP_TOPICS, componentsCopy } from '@/content/index.ts';
import Card from './Card.vue';

const copy = componentsCopy.help;
</script>

<template>
  <Card class="help-topics" :title="copy.legend" :hint="copy.hint">
    <article v-for="topic in HELP_TOPICS" :key="topic.id" class="help-topic">
      <h2>
        <a v-if="topic.href" :href="topic.href">{{ topic.title }}</a>
        <span v-else>{{ topic.title }}</span>
      </h2>
      <p class="tagline">{{ topic.lead }}</p>
      <dl>
        <div v-for="item in topic.items" :key="item.name">
          <dt>{{ item.name }}</dt>
          <dd>{{ item.text }}</dd>
        </div>
      </dl>
    </article>
  </Card>
</template>
