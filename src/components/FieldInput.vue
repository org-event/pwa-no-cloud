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
    disabled?: boolean;
    inputAriaLabel?: string;
    /** When set, renders a textarea. */
    rows?: number;
  }>(),
  {
    label: undefined,
    placeholder: undefined,
    name: undefined,
    type: 'text',
    autocomplete: 'off',
    maxlength: undefined,
    readonly: false,
    disabled: false,
    inputAriaLabel: undefined,
    rows: undefined,
  },
);

defineOptions({ inheritAttrs: false });

const model = defineModel<string>({ default: '' });
</script>

<template>
  <fieldset class="outlined-field">
    <legend v-if="label || $slots.label">
      <slot name="label">{{ label }}</slot>
    </legend>
    <textarea
      v-if="rows"
      v-bind="$attrs"
      v-model="model"
      :name="name"
      :rows="rows"
      :placeholder="placeholder"
      :readonly="readonly"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :aria-label="inputAriaLabel || label"
    />
    <input
      v-else
      v-bind="$attrs"
      v-model="model"
      :type="type"
      :name="name"
      :placeholder="placeholder"
      :readonly="readonly"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :maxlength="maxlength === undefined ? undefined : Number(maxlength)"
      :aria-label="inputAriaLabel || label"
    />
  </fieldset>
</template>
