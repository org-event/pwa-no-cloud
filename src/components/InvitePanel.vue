<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useNocloudStore } from '@/stores/nocloud.ts';
import Card from './Card.vue';
import FieldInput from './FieldInput.vue';

const store = useNocloudStore();
const { invite } = storeToRefs(store);
const copy = componentsCopy.invite;

const paste = ref('');

const manual = computed(() => invite.value.mode === 'manual');

const hint = computed(() => {
  if (!manual.value) {
    return invite.value.connected ? copy.channelOpen : copy.roomAutoOpen;
  }
  if (invite.value.role === 'caller') return copy.callerHint;
  if (invite.value.role === 'callee') return copy.calleeHint;
  return invite.value.connected ? copy.channelOpen : '';
});
</script>

<template>
  <Card v-show="manual" :title="copy.legend" :hint="hint">
    <label v-show="manual" class="choice">
      <input
        type="checkbox"
        :checked="invite.shareWithPeer"
        :disabled="!invite.canShareServers"
        @change="
          store.onShareWithPeer(($event.target as HTMLInputElement).checked)
        "
      />
      <span>{{ copy.shareServers }}</span>
    </label>

    <img
      v-if="manual && invite.qrUrl"
      :src="invite.qrUrl"
      :alt="copy.qrAlt"
      class="invite-qr"
    />

    <FieldInput
      v-show="manual"
      :model-value="invite.outgoing"
      :label="copy.outgoingAria"
      readonly
      :rows="6"
    />

    <div v-show="manual" class="home-actions">
      <button
        type="button"
        class="button button-secondary"
        :disabled="!invite.outgoing"
        @click="store.onCopy()"
      >
        {{ copy.copy }}
      </button>
      <button
        type="button"
        class="button"
        :disabled="!invite.outgoing"
        @click="store.onShareLink()"
      >
        {{ copy.shareLink }}
      </button>
    </div>

    <FieldInput
      v-show="manual"
      v-model="paste"
      :label="copy.incomingAria"
      :rows="6"
      :placeholder="copy.pastePlaceholder"
    />

    <p v-if="invite.error" class="error" role="alert">{{ invite.error }}</p>

    <template #actions>
      <button
        type="button"
        class="button"
        :disabled="invite.connected"
        @click="store.onApplyPaste(paste)"
      >
        {{ copy.acceptText }}
      </button>
      <button
        type="button"
        class="button button-accent"
        :disabled="!invite.connected"
        @click="store.onPing()"
      >
        Ping
      </button>
    </template>
  </Card>
</template>
