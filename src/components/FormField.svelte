<script lang="ts">
  export let label: string;
  export let description: string | null = null;
  export let wide = false;
  export let className = '';
  export let required = false;
  export let forId: string | null = null;

  $: rootClass = ['form-field', className].filter(Boolean).join(' ');
</script>

<label class={rootClass} class:wide for={forId ?? undefined}>
  <span class="field-label">
    {label}
    {#if required}
      <span aria-hidden="true" class="required">*</span>
    {/if}
  </span>
  <slot />
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
