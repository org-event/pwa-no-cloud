<script setup lang="ts">
import { componentsCopy, probeCopy } from '@/content/index.ts';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { customDraftToForm, readCustomDraft } from '@/ui/servers-form.ts';
import Card from './Card.vue';
import FieldInput from './FieldInput.vue';

const store = useNocloudStore();
const { state } = storeToRefs(store);

const formError = ref('');
const probeNotice = ref('');
const customForm = reactive(customDraftToForm(state.value.settings.custom));
const editing = ref(false);
const openId = ref<string | null>(state.value.activeServerId);

watch(
  () => state.value.settings.custom,
  (custom) => {
    if (!editing.value) Object.assign(customForm, customDraftToForm(custom));
  },
  { deep: true },
);

watch(
  () => state.value.activeServerId,
  (id) => {
    if (id) openId.value = id;
  },
);

const savedServers = computed(() => state.value.savedServers);
const activeServerId = computed(() => state.value.activeServerId);
const manualReach = computed(() => state.value.manualReach);
const hasServers = computed(() => savedServers.value.length > 0);

onMounted(() => {
  store.seedDemoServers();
});

const onToggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
};

const onSelect = (id: string) => {
  store.onSelectSavedServer(id);
  openId.value = id;
};

const onDelete = (id: string, event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  store.onRemoveSavedServer(id);
  if (openId.value === id) openId.value = null;
};

const onProbeSaved = (id: string, event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  void store.onProbeSavedServer(id);
};

const onProbeManual = async () => {
  formError.value = '';
  probeNotice.value = '';
  const draft = readCustomDraft(customForm);
  if ('error' in draft) {
    formError.value = draft.error;
    return;
  }
  const result = await store.onProbeDraft(draft);
  probeNotice.value = result.ok
    ? probeCopy.socketUp
    : probeCopy.socketDown(result.message);
};

const onSaveManual = async (event: Event) => {
  event.preventDefault();
  formError.value = '';
  probeNotice.value = '';
  const draft = readCustomDraft(customForm);
  if ('error' in draft) {
    formError.value = draft.error;
    return;
  }
  await store.onSaveCustomToList(draft);
};
</script>

<template>
  <Card
    :title="componentsCopy.servers.savedLegend"
    :hint="!hasServers ? componentsCopy.servers.savedEmpty : undefined"
  >
    <div
      v-if="hasServers"
      class="server-accordion"
      role="radiogroup"
      :aria-label="componentsCopy.servers.savedLegend"
    >
      <div
        v-for="server in savedServers"
        :key="server.id"
        class="server-item"
        :data-active="String(server.id === activeServerId)"
        :data-open="String(server.id === openId)"
      >
        <div class="server-summary-row">
          <button
            type="button"
            role="radio"
            class="server-summary"
            :aria-checked="server.id === activeServerId"
            @click="onSelect(server.id)"
          >
            <span
              class="presence"
              :data-online="String(server.reach === 'up')"
              :data-busy="String(server.reach === 'checking')"
              :aria-label="
                server.reach === 'up'
                  ? probeCopy.reachUp
                  : server.reach === 'down'
                    ? probeCopy.reachDown
                    : server.reach === 'checking'
                      ? probeCopy.reachChecking
                      : probeCopy.reachUnknown
              "
            />
            <span class="server-summary-text">
              <strong>{{ server.title }}</strong>
              <span class="tagline">{{ server.address }}</span>
            </span>
            <span v-if="server.id === activeServerId" class="server-badge">
              {{ componentsCopy.servers.active }}
            </span>
          </button>
          <button
            type="button"
            class="server-expand"
            :aria-expanded="server.id === openId"
            :aria-label="componentsCopy.servers.details"
            @click="onToggle(server.id)"
          >
            <span aria-hidden="true">{{
              server.id === openId ? '▴' : '▾'
            }}</span>
          </button>
        </div>
        <div v-show="server.id === openId" class="server-body">
          <pre class="resolved">{{
            JSON.stringify(server.draft, null, 2)
          }}</pre>
          <div class="home-actions">
            <button
              type="button"
              class="button button-secondary"
              @click="onProbeSaved(server.id, $event)"
            >
              {{ componentsCopy.servers.probe }}
            </button>
            <button
              type="button"
              class="button button-secondary"
              @click="onDelete(server.id, $event)"
            >
              {{ componentsCopy.servers.remove }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Card>

  <form
    @submit="onSaveManual"
    @focusin="editing = true"
    @focusout="editing = false"
  >
    <Card
      class="custom"
      :title="componentsCopy.servers.manualLegend"
      :hint="componentsCopy.servers.manualHint"
    >
      <FieldInput
        v-model="customForm.signalingUrl"
        :label="componentsCopy.servers.socketUrl"
        name="signalingUrl"
        type="url"
        placeholder="https://wss-203-0-113-10.sslip.io:8443"
      />
      <FieldInput
        v-model="customForm.stun"
        :label="componentsCopy.servers.stun"
        name="stun"
        :rows="3"
      />
      <FieldInput
        v-model="customForm.turnUrl"
        :label="componentsCopy.servers.turn"
        name="turnUrl"
        :rows="4"
        placeholder="turn:example.com:3478"
      />
      <FieldInput
        v-model="customForm.turnUser"
        :label="componentsCopy.servers.turnUser"
        name="turnUser"
      />
      <FieldInput
        v-model="customForm.turnPass"
        :label="componentsCopy.servers.turnPass"
        name="turnPass"
        type="password"
      />
      <FieldInput
        v-model="customForm.iceJson"
        :label="componentsCopy.servers.iceJson"
        name="iceJson"
        :rows="5"
        placeholder='[{"urls":"turn:...","username":"...","credential":"..."}]'
      />
      <template #actions>
        <div class="server-probe-row">
          <button
            type="button"
            class="button button-secondary"
            @click="onProbeManual"
          >
            {{ componentsCopy.servers.probe }}
          </button>
          <div class="server-manual-status" aria-live="polite">
            <span
              class="presence"
              :data-online="String(manualReach === 'up')"
              :data-busy="String(manualReach === 'checking')"
            />
            <span class="tagline">{{
              probeNotice ||
              (manualReach === 'up'
                ? probeCopy.socketUp
                : manualReach === 'down'
                  ? probeCopy.socketUnavailable
                  : probeCopy.probeHint)
            }}</span>
          </div>
        </div>
        <button class="button" type="submit">
          {{ componentsCopy.servers.saveToList }}
        </button>
      </template>
    </Card>
  </form>

  <p v-if="formError" class="error" role="alert">{{ formError }}</p>
</template>
