/**
 * Script to dynamically load the built app assets
 * This is injected into the index.html to find and load the correct hashed files
 */

(function() {
  // Find the CSS and JS files in the assets directory
  const findAssets = async () => {
    try {
      // In Electron, we can use the file system API through preload
      // For now, we'll use a simple approach with known patterns
      
      // Try to load the manifest if it exists
      const manifestResponse = await fetch('./assets/manifest.json').catch(() => null);
      if (manifestResponse && manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        return manifest;
      }
      
      // Fallback: look for index-*.js and index-*.css files
      // This is a simplified approach - in production you'd want to read the directory
      const scripts = document.querySelectorAll('script[src*="assets/index-"]');
      const styles = document.querySelectorAll('link[href*="assets/index-"]');
      
      if (scripts.length > 0 && styles.length > 0) {
        return; // Already loaded
      }
      
      // If not loaded, we need to find the files
      // For now, we'll use the most recent build pattern
      console.log('Loading app assets...');
      
      // Create and append the CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './dist/assets/index.css'; // Will be replaced with actual hash
      document.head.appendChild(link);
      
      // Create and append the JS module
      const script = document.createElement('script');
      script.type = 'module';
      script.src = './dist/assets/index.js'; // Will be replaced with actual hash
      document.body.appendChild(script);
      
    } catch (error) {
      console.error('Failed to load app assets:', error);
    }
  };
  
  // Load assets when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', findAssets);
  } else {
    findAssets();
  }
})();
