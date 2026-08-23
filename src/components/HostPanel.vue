<script setup lang="ts">
import { componentsCopy, serversCopy } from '@/content/index.ts';
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { installCommand } from '@/domain/turn-host.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import Card from './Card.vue';
import FieldInput from './FieldInput.vue';

const store = useNocloudStore();
const { state } = storeToRefs(store);
const copy = componentsCopy.host;

const sharePack = ref('');
const qrInput = ref<HTMLInputElement | null>(null);
const installLine = installCommand();

const onQrChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) store.onScanSharePack(file);
};

const onSavePack = () => {
  store.onApplySharePack(sharePack.value);
};
</script>

<template>
  <div class="card-stack">
    <Card :title="copy.installLegend" :hint="copy.installHint">
      <pre class="resolved install-line" :aria-label="copy.installAria">{{
        installLine
      }}</pre>
      <template #actions>
        <button
          type="button"
          class="button"
          @click="store.onCopyText(installLine, serversCopy.installerCopied)"
        >
          {{ copy.copy }}
        </button>
      </template>
    </Card>

    <Card :title="copy.packLegend" :hint="copy.packHint">
      <FieldInput
        v-model="sharePack"
        :label="copy.packLabel"
        name="sharePack"
        :rows="4"
        placeholder="S1.{…}"
      />
      <template #actions>
        <button type="button" class="button" @click="onSavePack">
          {{ copy.savePack }}
        </button>
        <button
          type="button"
          class="button button-secondary"
          @click="qrInput?.click()"
        >
          {{ copy.scanQr }}
        </button>
      </template>
    </Card>

    <input
      ref="qrInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="file-input"
      aria-hidden="true"
      tabindex="-1"
      @change="onQrChange"
    />

    <p class="tagline" aria-live="polite">{{ state.hostNotice }}</p>
  </div>
</template>
