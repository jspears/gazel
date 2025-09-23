# Gazel - Technical Details

## Architecture

### Frontend
- **Framework**: Svelte (vanilla, not SvelteKit) with TypeScript
- **UI Components**: Bits UI component library
- **Styling**: Tailwind CSS
- **Icons**: Lucide Svelte
- **Build Tool**: Vite
- **Syntax Highlighting**: highlight.js with Atom One Dark theme

### Backend
- **Runtime**: Node.js with Express (TypeScript)
- **Responsibilities**:
  - Execute Bazel commands (build, test, query)
  - Parse Bazel query responses (XML format) into JSON
  - Serve Svelte app assets
  - Provide REST APIs for search/navigation of Bazel build files
- **Parser**: xml2js for parsing Bazel XML output
- **Process Management**: Child process execution for Bazel commands

## Features in Detail

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
- **Run executable targets**:
  - Automatic detection of executable targets (binaries, tests)
  - One-click execution with "Run" button
  - Real-time output streaming in modal dialog
  - Shows exact command being executed
  - Clear success/failure indicators
  - Scrolling log with auto-scroll to latest output
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
- `GET /api/targets/outputs?target=...` - Get target outputs
- `GET /api/targets/dependencies?target=...` - Get target dependencies
- `GET /api/targets/info?target=...` - Get target details

### Query
- `POST /api/query` - Execute Bazel query
- `GET /api/query/saved` - Get saved queries
- `POST /api/query/save` - Save a query

### Build Files
- `GET /api/files/build` - List BUILD files
- `GET /api/files/build/:path` - Get BUILD file content
- `GET /api/files/workspace` - Get WORKSPACE file content
- `POST /api/files/search` - Search within files

### Commands
- `POST /api/commands/build` - Execute bazel build
- `POST /api/commands/build/stream` - Stream bazel build output (SSE)
- `POST /api/commands/run/stream` - Stream bazel run output (SSE)
- `POST /api/commands/test` - Execute bazel test
- `POST /api/commands/clean` - Clean Bazel cache
- `GET /api/commands/history` - Get command history

## Project Structure

```
gazel/
├── server/                 # Backend Node.js/Express server
│   ├── index.ts           # Main server file
│   ├── config.ts          # Configuration
│   ├── routes/            # API routes
│   │   ├── workspace.ts
│   │   ├── targets.ts
│   │   ├── query.ts
│   │   ├── files.ts
│   │   └── commands.ts
│   └── services/          # Business logic
│       ├── bazel.ts      # Bazel command execution
│       └── parser.ts     # Output parsing
├── src/                   # Frontend Svelte application
│   ├── App.svelte        # Main app component
│   ├── main.ts           # Entry point
│   ├── lib/              # Reusable components
│   │   ├── api/          # API client
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utility functions
│   └── routes/           # View components
│       ├── Workspace.svelte
│       ├── Targets.svelte
│       ├── Files.svelte
│       ├── Query.svelte
│       └── Commands.svelte
├── public/               # Static assets
├── dist/                 # Built frontend (generated)
├── package.json
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
├── setup.sh             # Setup script
├── .env.example         # Environment variables template
└── README.md
```

## Development Notes

### TypeScript Configuration
- Both frontend and backend use TypeScript
- Strict mode enabled for type safety
- Path aliases configured for cleaner imports

### Build Process
1. Frontend is built with Vite into `dist/` directory
2. Backend serves the built frontend in production
3. Development mode runs both servers concurrently

### State Management
- Uses Svelte stores for global state
- Local component state for UI-specific data
- API client handles all backend communication

### Error Handling
- All Bazel command failures include the exact command that failed
- Graceful fallback from Bazel query to text search
- User-friendly error messages with actionable information

### Performance Optimizations
- Lazy loading of target details
- Pagination for large result sets
- Caching of frequently accessed data
- Efficient XML parsing with streaming where possible

## Troubleshooting

### Common Issues

#### Bazel command not found
Ensure Bazel is installed and available in your PATH.

#### Permission denied errors
The server needs read access to the Bazel workspace directory.

#### Port already in use
Change the port by setting the `PORT` environment variable.

#### Workspace not detected
Make sure your workspace contains a `WORKSPACE` or `WORKSPACE.bazel` file.

#### Query syntax errors
The tool automatically falls back to text search when Bazel query syntax is invalid.

### Debug Mode
Set `DEBUG=gazel:*` to enable debug logging:
```bash
DEBUG=gazel:* npm run dev
```

## Contributing

### Code Style
- Use TypeScript for all new code
- Follow the existing code style
- Add types for all function parameters and return values
- Use meaningful variable and function names

### Testing
- Test with different Bazel workspace configurations
- Verify both query and text search functionality
- Check error handling for invalid inputs

### Pull Requests
- Include a clear description of changes
- Update documentation as needed
- Test your changes thoroughly
- Keep commits focused and atomic
