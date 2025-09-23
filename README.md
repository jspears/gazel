# Gazel - Bazel Exploration Tool

A graphical interface for inspecting Bazel build files and discovering available targets and commands.

## Architecture

### Frontend
- **Framework**: Svelte (vanilla, not SvelteKit) with TypeScript
- **UI Components**: Bits UI component library
- **Styling**: Tailwind CSS
- **Icons**: Lucide Svelte
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express (TypeScript)
- **Responsibilities**:
  - Execute Bazel commands (build, test, query)
  - Parse Bazel query responses (XML format) into JSON
  - Serve Svelte app assets
  - Provide REST APIs for search/navigation of Bazel build files
- **Parser**: xml2js for parsing Bazel XML output
- **Process Management**: Child process execution for Bazel commands

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Bazel ()

## Installation

1. Clone the repository:
```bash
$ git clone https://github.com/jspears/gazel
$ cd gazel
```

2. Run the setup script (recommended):
```bash
./setup.sh
```

The setup script will:
- Check for Node.js (>=18) and npm
- Detect Bazel workspaces in current and parent directories
- Prompt you to confirm or enter a custom workspace path
- Validate the workspace contains a WORKSPACE file
- Save the configuration to `.env`
- Install all npm dependencies

Or manually setup:
```bash
npm install
cp .env.example .env
# Edit .env to set your BAZEL_WORKSPACE path
```

## Configuration

The setup script automatically configures your Bazel workspace and saves it to `.env`.

To manually configure or change the workspace, edit the `.env` file:

```env
# Path to your Bazel workspace (directory containing WORKSPACE file)
BAZEL_WORKSPACE=/path/to/your/bazel/workspace
```

You can re-run `./setup.sh` at any time to reconfigure the workspace path.


## Development

Run both frontend and backend in development mode:
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:3001
- Frontend dev server on http://localhost:5173

## Production Build

1. Build the frontend:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The application will be available at http://localhost:3001

## Features

### Workspace Overview
- Display Bazel workspace metadata
- Show workspace configuration
- List available Bazel commands
- **Clickable BUILD files**: Click any BUILD file to navigate directly to the Files tab and view its contents

### Target Browser
- Browse all Bazel targets in the workspace
- Filter targets by type (binary, library, test, etc.)
- **Smart search with automatic fallback**:
  - Enter Bazel query expressions for powerful searches
  - Automatically falls back to text search if query syntax is invalid
  - Text search looks through target names, labels, packages, types, tags, and dependencies
  - Visual indicator shows when using text search mode
- View target dependencies
- **View target outputs/returns**: See what files each target produces
- Shows expected output types based on rule type (e.g., executables, libraries, JARs)
- Navigate directly to BUILD file definitions from target details

### Build File Explorer
- Navigate BUILD and WORKSPACE files
- **High-contrast syntax highlighting** with line numbers using highlight.js (Atom One Dark theme)
- **Starlark/Bazel syntax highlighting** for BUILD, WORKSPACE, and .bzl files with excellent readability
- Dark background with bright, distinct colors for maximum contrast
- Search within build files
- Quick navigation to target definitions
- **Interactive target exploration**: When viewing a BUILD file, see all targets in a sidebar
- Click on any target to highlight it in the code and view its details
- View target attributes, inputs, outputs, and dependencies directly from the file view

### Query Interface
- Execute custom Bazel queries
- View query results in structured format
- Save and reuse common queries
- Export query results

### Command Execution
- Execute Bazel build and test commands
- Stream build output in real-time
- View command history
- Clean Bazel cache
- **Enhanced error reporting**: When commands fail, displays the exact Bazel command that was executed

### Dependency Graph
- Visualize target dependencies
- Interactive graph navigation
- Filter by depth and target type

## API Endpoints

### Workspace Information
- `GET /api/workspace/info` - Get workspace metadata
- `GET /api/workspace/files` - List BUILD files

### Targets
- `GET /api/targets` - List all targets
- `GET /api/targets/:target` - Get target details
- `GET /api/targets/:target/dependencies` - Get target dependencies

### Query
- `POST /api/query` - Execute Bazel query
- `GET /api/query/saved` - Get saved queries
- `POST /api/query/save` - Save a query

### Build Files
- `GET /api/files/build` - List BUILD files
- `GET /api/files/build/:path` - Get BUILD file content
- `GET /api/files/workspace` - Get WORKSPACE file content

### Commands
- `POST /api/build` - Execute bazel build
- `POST /api/test` - Execute bazel test
- `GET /api/commands/history` - Get command history

## Project Structure

```
gazel/
├── server/                 # Backend Node.js/Express server
│   ├── index.js           # Main server file
│   ├── config.js          # Configuration
│   ├── routes/            # API routes
│   │   ├── workspace.js
│   │   ├── targets.js
│   │   ├── query.js
│   │   ├── files.js
│   │   └── commands.js
│   └── services/          # Business logic
│       ├── bazel.js      # Bazel command execution
│       └── parser.js     # Output parsing
├── src/                   # Frontend Svelte application
│   ├── App.svelte        # Main app component
│   ├── main.js           # Entry point
│   ├── lib/              # Reusable components
│   │   ├── components/   # UI components
│   │   ├── stores/       # Svelte stores
│   │   └── utils/        # Utility functions
│   └── routes/           # View components
│       ├── Workspace.svelte
│       ├── Targets.svelte
│       ├── Files.svelte
│       └── Query.svelte
├── public/               # Static assets
├── dist/                 # Built frontend (generated)
├── package.json
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
└── README.md

```

## Troubleshooting

### Bazel command not found
Ensure Bazel is installed and available in your PATH.

### Permission denied errors
The server needs read access to the Bazel workspace directory.

### Port already in use
Change the port set the `PORT` environment variable.

## License

MIT
