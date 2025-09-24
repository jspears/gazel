# Gazel - Example Usage Guide

## Starting the Application

### Development Mode
```bash
# Install dependencies (first time only)
npm install

# Start both frontend and backend in development mode
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Production Mode
```bash
# Build the application
npm run build

# Start the production server
npm start
```

The application will be available at http://localhost:3001

## Using the Application

### 1. Workspace Overview

When you first open Gazel, you'll see the **Workspace** tab which displays:
- Workspace name and path
- Bazel version
- Number of BUILD files
- Configuration options from .bazelrc
- **Clickable BUILD files**: Recent BUILD files are displayed as clickable links

**Quick Navigation Tip**:
- Hover over any BUILD file to see the external link icon
- Click on any BUILD file to immediately jump to the Files tab and view its contents
- This provides a quick way to explore your workspace structure
- List of recent BUILD files

### 2. Browsing Targets

Click on the **Targets** tab to:
- View all Bazel targets in the workspace
- **Smart search with automatic fallback**:
  - Enter Bazel query expressions like `deps(//src:main)` or `kind("cc_library", //...)`
  - Or simply type text to search through names, labels, packages, and dependencies
  - If a Bazel query fails, the tool automatically switches to text search
  - An amber indicator shows when using text search mode
- Filter targets by type (binary, library, test, etc.)
- View target details including:
  - Rule type with expected output description
  - **Outputs/Returns**: See actual files the target produces
  - Location in source with link to BUILD file
  - Attributes
  - Direct dependencies

#### Understanding Target Outputs
When you select a target, you'll see:
1. **Expected outputs** based on the rule type (e.g., "Executable binary file" for cc_binary)
2. **Actual output files** that will be generated when the target is built
3. File types are highlighted (e.g., `.so`, `.a`, `.jar`, `.exe`)

#### Running Executable Targets
For executable targets (binaries and tests), you'll see a **"Run Target"** button:
1. Click the green "Run" button that appears for executable targets
2. A modal dialog opens showing:
   - The exact `bazel run` command being executed
   - Real-time streaming output from the command
   - Auto-scrolling log that follows the output
3. The modal shows clear status indicators:
   - ⏳ Running - while the command is executing
   - ✅ Success - when the command completes successfully
   - ❌ Failed - if the command encounters an error
4. Click "Close" to dismiss the modal (this also stops the stream if still running)

Example searches:
- **Bazel queries**: `deps(//src:main)`, `kind(".*_test", //...)`, `attr(visibility, "//visibility:public", //...)`
- **Text search**: "server" to find all server-related targets
- **Combined**: Search for "proto" then filter by "cc_library" type
- Click on any target to see what it produces
- Click "View in BUILD file" to navigate to the target's definition

### 3. Exploring Build Files

The **Files** tab allows you to:
- Browse all BUILD and WORKSPACE files
- View file contents with **syntax highlighting** and line numbers
- **Starlark/Bazel syntax highlighting** with color-coded keywords, strings, functions, and comments
- Search within files for specific patterns
- View the WORKSPACE file and external dependencies
- **Interactively explore targets within BUILD files**

Example usage:
- Click on any BUILD file to view its contents with full syntax highlighting
- When viewing a BUILD file, a **Targets panel** appears showing all targets in that file
- Click on any target in the panel to:
  - Highlight the target definition in the code
  - View detailed target information including attributes, inputs, and outputs
- Use the search box to find files containing specific rules
- Click "View WORKSPACE" to see external dependencies

**Syntax Highlighting Features** (High-contrast Atom One Dark theme):
- Keywords (def, if, for, etc.) are highlighted in bright purple with bold text
- Strings appear in bright green for excellent visibility
- Function names in bright blue with bold text
- Comments in light gray italic for better readability
- Numbers in orange for clear distinction
- Built-in functions in cyan with bold text
- Parameters and names in red/pink for easy identification
- Dark background (#1e2127) provides maximum contrast

#### Interactive Target Navigation
1. Select a BUILD file from the left panel
2. The middle panel shows the file content with line numbers
3. The right panel (when available) shows all targets in the file
4. Click on a target to:
   - Jump to its definition in the code (highlighted)
   - View its details at the bottom of the screen
5. From the Targets tab, click the "View in BUILD file" button to navigate directly to a target's definition

### 4. Running Queries

The **Query** tab provides a powerful interface for Bazel queries:

#### Using Templates
1. Click on a query template from the left panel
2. Modify the query as needed
3. Click "Execute" to run the query

#### Common Queries
```bazel
# List all targets
//...

# Find all test targets
kind("test", //...)

# Find dependencies of a target
deps(//path/to:target)

# Find what depends on a target
rdeps(//..., //path/to:target)

# Find all cc_binary targets
kind("cc_binary", //...)
```

#### Saving Queries
1. Write your query
2. Click "Save"
3. Enter a name and optional description
4. Your saved queries appear in the left panel

### 5. Executing Commands

The **Commands** tab lets you:
- Build targets
- Run tests
- View command output with enhanced error reporting
- Track command history

#### Building a Target
1. Enter target name (e.g., `//src/server:main`)
2. Add optional flags (e.g., `--config=debug`)
3. Click "Build"
4. View output in the right panel
5. **If the build fails**, you'll see:
   - The error message
   - The exact Bazel command that was executed
   - Detailed error output from Bazel

#### Running Tests
1. Enter test target (e.g., `//test:all`)
2. Click "Test"
3. View test results
4. Failed tests show the complete command for debugging

#### Streaming Builds
For long-running builds:
1. Enter target
2. Click "Stream Build"
3. Watch real-time output

#### Error Reporting
When any command fails, the error message now includes:
- The exact `bazel` command that was executed
- Full stderr output
- Suggestions for fixing common issues
This makes it easy to:
- Reproduce the error in terminal
- Share the exact command with teammates
- Debug configuration issues

## API Endpoints

The backend provides RESTful APIs that can be accessed directly:

### Get Workspace Info
```bash
curl http://localhost:3001/api/workspace/info
```

### List All Targets
```bash
curl http://localhost:3001/api/targets
```

### Execute a Query
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "//...", "outputFormat": "label_kind"}'
```

### Build a Target
```bash
curl -X POST http://localhost:3001/api/commands/build \
  -H "Content-Type: application/json" \
  -d '{"target": "//src:app", "options": ["--config=opt"]}'
```

## Tips and Tricks

### Performance
- The query results are cached for 1 minute to improve performance
- Use specific patterns instead of `//...` when possible
- Filter results client-side when the full list is already loaded

### Navigation
- Click on any target name to view its details
- Use keyboard shortcuts:
  - `/` to focus search box
  - `Tab` to navigate between tabs
  - `Enter` to execute queries

### Troubleshooting

#### Bazel not found
Ensure Bazel is installed and in your PATH:
```bash
which bazel
bazel version
```

#### Permission denied
The server needs read access to the Bazel workspace:
```bash
ls -la /your/workspace
```

#### Port already in use
Change the port in `server/config.ts` or use environment variables:
```bash
PORT=3002 npm start
```

## Advanced Configuration

### Environment Variables
```bash
# Change Bazel workspace
BAZEL_WORKSPACE=/path/to/workspace npm run dev

# Change server port
PORT=3002 npm run dev

# Use different Bazel executable
BAZEL_EXECUTABLE=/usr/local/bin/bazel npm run dev
```



## Example Workflows

### Finding Unused Dependencies
1. Go to Query tab
2. Use template "Reverse dependencies"
3. Enter your library target
4. Execute to see what depends on it
5. If empty, the library might be unused

### Debugging Build Failures
1. Go to Commands tab
2. Enter failing target
3. Add `--verbose_failures` to options
4. Click Build
5. Check output for detailed error messages

### Exploring a New Codebase
1. Start with Workspace tab to understand structure
2. Browse Targets to see main binaries and libraries
3. Use Query to explore dependencies
4. Check Files to understand BUILD file organization
