<script lang="ts">
  let {
    label,
    type = 'text',
    value = '',
    placeholder = '',
    required = false,
    disabled = false,
    autocomplete,
    inputmode,
    min,
    max,
    step,
    oninput
  }: {
    label?: string;
    type?: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    autocomplete?: 'on' | 'off' | 'name' | 'email' | 'tel' | 'url' | 'one-time-code' | 'postal-code' | 'cc-number';
    inputmode?: 'text' | 'search' | 'none' | 'email' | 'decimal' | 'url' | 'numeric' | 'tel';
    min?: number;
    max?: number;
    step?: number;
    oninput?: (value: string) => void;
  } = $props();

  const id = `field-${Math.random().toString(36).slice(2, 9)}`;
</script>

{#if label}
  <label class="field-label" for={id}>{label}</label>
{/if}
<input
  id={id}
  class="field field-input"
  {type}
  {placeholder}
  {required}
  {disabled}
  {autocomplete}
  {inputmode}
  {min}
  {max}
  {step}
  {value}
  oninput={(e) => oninput?.((e.currentTarget as HTMLInputElement).value)}
/>

<style>
  .field-label {
    display: block;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--c-text-2);
    margin-bottom: 6px;
  }
  .field-input { width: 100%; }
</style>
