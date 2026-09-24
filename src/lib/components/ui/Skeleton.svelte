<script lang="ts">
  let {
    width = '100%',
    height = '16px',
    radius = 'var(--r-md)',
    style = ''
  }: {
    width?: string;
    height?: string;
    radius?: string;
    style?: string;
  } = $props();
</script>

<div class="skeleton" style={`width:${width};height:${height};border-radius:${radius};${style}`} aria-hidden="true"></div>
