<script lang="ts">
  import '../app.css';
</script>

<div class="app-root">
  <slot />
</div>

<style>
  :global(html), :global(body) {
    background: var(--c-bg, #060912);
    color: var(--c-text, #f1f5ff);
    font-family: var(--font-brand, 'Outfit', system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-tap-highlight-color: transparent;
  }
  :global(:focus-visible) {
    outline: 2px solid var(--c-indigo, #6366f1);
    outline-offset: 2px;
    border-radius: 6px;
  }
  :global(select), :global(button), :global(input), :global(textarea) {
    font-family: var(--font-brand, 'Outfit', system-ui, sans-serif);
  }
  :global(button) { cursor: pointer; }
  :global(*), :global(*::before), :global(*::after) { box-sizing: border-box; }
  .app-root { min-height: 100dvh; }
</style>
