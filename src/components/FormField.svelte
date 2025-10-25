<svelte:options runes />

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    description = null,
    wide = false,
    className = '',
    required = false,
    forId = null,
    children,
  }: {
    label: string;
    description?: string | null;
    wide?: boolean;
    className?: string;
    required?: boolean;
    forId?: string | null;
    children?: Snippet;
  } = $props();

  const rootClass = $derived(
    ['form-field', className].filter(Boolean).join(' ')
  );
</script>

<label class={rootClass} class:wide for={forId ?? undefined}>
  <span class="field-label">
    {label}
    {#if required}
      <span aria-hidden="true" class="required">*</span>
    {/if}
  </span>
  {@render children?.()}
  {#if description}
    <small>{description}</small>
  {/if}
</label>

<style>
  :global(.api-box .form-field) {
    display: grid;
    gap: 0.25rem;
    font-size: 0.9rem;
    color: var(--muted-fg);
  }

  .form-field.wide {
    grid-column: 1 / -1;
  }

  .field-label {
    font-weight: 500;
    color: inherit;
  }

  .required {
    margin-left: 0.25rem;
    color: var(--accent-fg, #d84b4b);
    font-size: 0.8em;
  }

  small {
    font-size: 0.8rem;
    color: inherit;
    opacity: 0.85;
  }
</style>
