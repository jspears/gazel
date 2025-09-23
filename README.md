# Gazel

**A modern web-based UI for exploring and understanding Bazel workspaces**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)

## What is Gazel?

Gazel is a powerful visualization and exploration tool for Bazel build systems. It provides an intuitive web interface to:

- 🔍 **Browse and search** Bazel targets across your entire workspace
- 📄 **View BUILD files** with syntax highlighting and interactive navigation
- 🎯 **Understand target dependencies** and see what files targets produce
- 🚀 **Execute Bazel commands** with real-time output streaming
- 📊 **Run complex queries** using Bazel query language or simple text search

Whether you're new to Bazel or an experienced developer, Gazel makes it easy to understand and navigate complex build configurations.

## Screenshot

![Gazel Interface](docs/image.png)

## Demo Video

Watch Gazel in action: [View Demo](docs/gazel-bazel.mov)

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Bazel** (any recent version)

### Installation

```bash
# Clone the repository
git clone https://github.com/jspears/gazel
cd gazel

# Install dependencies
npm install

# Start the application
npm run dev
```

**That's it!** Open http://localhost:5173 in your browser.

When you first open Gazel:
- 🔍 It will automatically scan for Bazel workspaces
- 📁 You can select from discovered workspaces or enter a custom path
- 💾 Your selection is saved for future sessions
- 🔄 You can switch workspaces anytime by clicking the path in the Workspace tab

### Optional: Using the Setup Script

For automatic workspace detection during initial setup:

```bash
# Run the interactive setup script (optional)
./setup.sh
```

The setup script will:
- ✅ Check system requirements
- 🔍 Find your Bazel workspace
- 📝 Create initial .env configuration
- 📦 Install dependencies (if not already installed)

Note: The setup script is optional. Gazel can now configure workspaces through its UI.

## Running Gazel

### Development Mode

```bash
npm run dev
```

Opens:
- 🌐 **Frontend**: http://localhost:5173
- 🔧 **API**: http://localhost:3001

### Production Mode

```bash
# Build the application
npm run build

# Start the production server
npm start
```

Visit http://localhost:3001

### Configuration

Gazel stores workspace configuration in two places:

1. **Browser Local Storage** (Primary)
   - Workspace selection is saved automatically
   - Persists across browser sessions
   - Switch workspaces via the UI

2. **`.env` file** (Optional)
   - Created by setup script or when switching workspaces
   - Can be edited manually if needed
   ```env
   BAZEL_WORKSPACE=/path/to/your/bazel/workspace
   PORT=3001  # Optional: change the server port
   ```

To switch workspaces:
- Click on the workspace path in the Workspace tab, or
- Clear browser local storage to reset selection

## What Can You Do With Gazel?

### 🎯 Explore Targets
- **Browse** all targets in your workspace with a clean, searchable interface
- **Smart search** - Use Bazel queries or simple text search
- **Filter** by target type (binary, library, test, etc.)
- **Run executables** - Click "Run" button for any executable target with real-time output streaming
- **See outputs** - Understand what files each target produces
- **Navigate** directly to target definitions in BUILD files

### 📄 Browse BUILD Files
- **Syntax highlighting** for Bazel/Starlark code
- **Interactive navigation** - Click targets to see their details
- **Search** within files to find specific rules
- **Jump** between related files and targets

### 🔍 Run Queries
- **Execute** Bazel query expressions with a friendly UI
- **Save** frequently used queries for quick access
- **Export** results for further analysis
- **Fallback** to text search when queries fail

### 🚀 Execute Commands
- **Build** targets with real-time output streaming
- **Run tests** and see results immediately
- **View history** of all executed commands
- **Debug** with exact command reproduction

### 📊 Visualize Dependencies
- **Graph view** of target dependencies
- **Interactive exploration** of the dependency tree
- **Filter** by depth and target type

## Screenshots

*Coming soon - See [EXAMPLE_USAGE.md](EXAMPLE_USAGE.md) for detailed usage examples*

## Documentation

- 📖 **[Usage Examples](EXAMPLE_USAGE.md)** - Step-by-step guide with examples
- 🔧 **[Technical Details](TECHNICAL_DETAILS.md)** - Architecture, API, and development notes
- 🚀 **[Contributing](CONTRIBUTING.md)** - How to contribute to the project

## Troubleshooting

### Common Issues

**Bazel not found**
- Make sure Bazel is installed and in your PATH
- Test with: `bazel version`

**Port already in use**
- Change the port in `.env`: `PORT=3002`
- Or use a different port: `PORT=3002 npm run dev`

**Workspace not detected**
- Ensure your workspace has a `MODULE.bazel` file
- Run `./setup.sh` to reconfigure

**Permission denied**
- The server needs read access to your Bazel workspace
- Check file permissions: `ls -la /path/to/workspace`

### Getting Help

- 📝 Check the [documentation](TECHNICAL_DETAILS.md)
- 🐛 [Report issues](https://github.com/jspears/gazel/issues)
- 💬 [Start a discussion](https://github.com/jspears/gazel/discussions)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details

## Acknowledgments

Built with:
- [Svelte](https://svelte.dev/) - Cybernetically enhanced web apps
- [Bazel](https://bazel.build/) - Fast, reliable build system
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [highlight.js](https://highlightjs.org/) - Syntax highlighting

---

**Made with ❤️ for the Bazel community**
