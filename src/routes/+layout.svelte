<script lang="ts">
  import '../app.css';
</script>

<div class="app-root">
  <slot />
</div>

<style>
  /* All component styles live in components; layout adds zero visual chrome */
  :global(html), :global(body) {
    background: #080b12;
    color: #f7fbff;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-tap-highlight-color: transparent;
  }
  :global(:focus-visible) {
    outline: 2px solid #38bdf8;
    outline-offset: 2px;
    border-radius: 6px;
  }
  :global(select), :global(button), :global(input) {
    font-family: inherit;
  }
  :global(button) { cursor: pointer; }
  :global(*), :global(*::before), :global(*::after) { box-sizing: border-box; }
</style>
