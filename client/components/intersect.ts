

export function intersect(root: HTMLElement, callback: ()=>void) {
        // Set up intersection observer for infinite scrolling
    const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              callback();
            }
          });
        },
        { threshold: 0.1 }
      );

    observer.observe(root);

    return {
      destroy() {
        observer.disconnect();
      }
    };
  }