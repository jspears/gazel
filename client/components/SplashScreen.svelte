<script lang="ts">
  const {
    isLoading = $bindable(true),
    message = 'Loading Gazel...'
  }: {
    isLoading?: boolean;
    message?: string;
  } = $props();

  let fadeOut = $state(false);

  // Watch for loading to complete and trigger fade out
  $effect(() => {
    if (!isLoading && !fadeOut) {
      fadeOut = true;
    }
  });
</script>

<div 
  class="splash-screen {fadeOut ? 'fade-out' : ''}"
  aria-live="polite"
  aria-busy={isLoading}
>
  <div class="splash-content">
    <div class="logo-container">
      <img src="/icon-32.png" alt="Gazel Logo" class="logo" />
      <h1 class="app-name">Gazel</h1>
    </div>
    
    <div class="loading-container">
      <div class="spinner"></div>
      <p class="loading-message">{message}</p>
    </div>
  </div>
</div>

<style>
  .splash-screen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: hsl(var(--background));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.3s ease-out;
  }

  .splash-screen.fade-out {
    opacity: 0;
    pointer-events: none;
  }

  .splash-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
  }

  .logo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    animation: fadeInScale 0.5s ease-out;
  }

  .logo {
    width: 64px;
    height: 64px;
    animation: pulse 2s ease-in-out infinite;
  }

  .app-name {
    font-size: 2rem;
    font-weight: bold;
    color: hsl(var(--foreground));
    margin: 0;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid hsl(var(--muted));
    border-top-color: hsl(var(--primary));
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-message {
    color: hsl(var(--muted-foreground));
    font-size: 0.875rem;
    margin: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>

