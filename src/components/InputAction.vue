<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Legend text — sits on the outline and breaks the border. */
    label?: string;
    placeholder?: string;
    name?: string;
    type?: string;
    autocomplete?: string;
    maxlength?: number | string;
    readonly?: boolean;
    inputAriaLabel?: string;
    /** Visible button text when no icon (or use #button slot). */
    buttonLabel?: string;
    /** Built-in icon; replaces button text. */
    icon?: 'plus' | 'copy' | 'check';
    /** Native tooltip on the button (`title`). */
    tooltip?: string;
    /** Accessible name; defaults to tooltip, then buttonLabel. */
    buttonAriaLabel?: string;
    disabled?: boolean;
    buttonClass?: string;
  }>(),
  {
    label: undefined,
    placeholder: undefined,
    name: undefined,
    type: 'text',
    autocomplete: 'off',
    maxlength: undefined,
    readonly: false,
    inputAriaLabel: undefined,
    buttonLabel: undefined,
    icon: undefined,
    tooltip: undefined,
    buttonAriaLabel: undefined,
    disabled: false,
    buttonClass: undefined,
  },
);

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ default: '' });

const emit = defineEmits<{
  action: [];
  enter: [];
}>();
</script>

<template>
  <fieldset class="outlined-field" v-bind="$attrs">
    <legend v-if="label || $slots.label">
      <slot name="label">{{ label }}</slot>
    </legend>
    <div class="outlined-field-row">
      <input
        v-model="model"
        :type="type"
        :name="name"
        :placeholder="placeholder"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :maxlength="maxlength === undefined ? undefined : Number(maxlength)"
        :aria-label="inputAriaLabel || label"
        @keydown.enter.prevent="emit('enter')"
      />
      <button
        type="button"
        :class="
          buttonClass ?? (icon ? 'icon-button' : 'button button-secondary')
        "
        :title="tooltip"
        :aria-label="buttonAriaLabel || tooltip || buttonLabel"
        :disabled="disabled"
        @click="emit('action')"
      >
        <slot name="button">
          <svg
            v-if="icon === 'plus'"
            class="icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              d="M12 5v14M5 12h14"
            />
          </svg>
          <svg
            v-else-if="icon === 'copy'"
            class="icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 8h10v12H8z"
            />
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"
            />
          </svg>
          <svg
            v-else-if="icon === 'check'"
            class="icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 12l5 5L20 7"
            />
          </svg>
          <template v-else>{{ buttonLabel }}</template>
        </slot>
      </button>
    </div>
  </fieldset>
</template>
