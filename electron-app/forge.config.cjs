module.exports = {
  packagerConfig: {
    asar: true,
    name: 'Gazel',
    icon: '../assets/icon' // Will look for icon.icns on macOS, icon.ico on Windows
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Gazel'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'gazel',
          productName: 'Gazel'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'gazel',
          productName: 'Gazel'
        }
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be
        // Main process, Preload scripts, Worker process, etc.
        build: [
          {
            // `entry` is an alias for `build.lib.entry`
            // in the corresponding file of `config`.
            entry: '../electron/main.ts',
            config: 'electron-app/vite.main.config.mjs'
          },
          {
            entry: '../electron/preload.ts',
            config: 'electron-app/vite.preload.config.mjs'
          }
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'electron-app/vite.renderer.config.mjs'
          }
        ]
      }
    }
  ],
};
