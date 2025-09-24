# Bazel Dependency Graph Visualization

This project now includes an interactive dependency graph visualization feature using @xyflow/svelte.

## Features

- **Interactive Graph Visualization**: View Bazel target dependencies as an interactive node graph
- **XML Parsing**: Parses Bazel query XML output to extract dependency relationships
- **Streaming Support**: Stream and parse large XML outputs using SAX parser for memory efficiency
- **Query Options**: Control query depth and scope (all dependencies vs direct only)
- **Node Coloring**: Different rule types are color-coded for easy identification
- **Zoom & Pan**: Navigate large dependency graphs with built-in controls
- **MiniMap**: Overview of the entire graph for easy navigation
- **Export Options**: Download graphs as SVG or DOT format
- **Filtering**: Filter targets by name to focus on specific parts of the graph
- **Clickable Nodes**: Click on nodes to view details (target name, rule class, location)

## How to Use

1. **Navigate to the Graph Tab**
   - Open the application at http://localhost:5173
   - Click on the "Graph" tab in the navigation menu

2. **Generate a Dependency Graph**
   - Enter a target pattern in the input field, for example:
     - `//app:main` - Dependencies of a specific target
     - `//...` - All targets in the workspace
     - `//lib/...` - All targets under lib/ directory
   - Click "Generate Graph" or press Enter

3. **Interact with the Graph**
   - **Zoom**: Use mouse wheel or the zoom controls
   - **Pan**: Click and drag on the canvas
   - **Select Node**: Click on a node to view its details
   - **MiniMap**: Use the minimap in the corner for navigation

4. **Export the Graph**
   - Click "SVG" to download as a vector image
   - Click "DOT" to download in Graphviz DOT format
   - Toggle "Show XML" to view the raw XML data

## Implementation Details

### Components

1. **DependencyGraph.svelte** (`src/components/DependencyGraph.svelte`)
   - Main graph visualization component
   - Uses @xyflow/svelte for rendering
   - Handles node positioning with hierarchical layout
   - Color-codes nodes by rule type

2. **DependencyGraph Route** (`src/routes/DependencyGraph.svelte`)
   - UI for entering target patterns
   - Handles API calls to fetch dependency data
   - Provides export functionality
   - Shows example targets for quick access

3. **XML Parser** (`src/lib/utils/xmlParser.ts`)
   - Parses Bazel XML output using browser's DOMParser
   - Extracts nodes and edges from the dependency tree
   - Formats labels for display

### Node Colors by Rule Type

- **cc_library**: Blue (#3b82f6)
- **cc_binary**: Green (#10b981)
- **cc_test**: Orange (#f59e0b)
- **java_library**: Purple (#8b5cf6)
- **java_binary**: Pink (#ec4899)
- **java_test**: Orange (#f97316)
- **py_library**: Cyan (#06b6d4)
- **py_binary**: Lime (#84cc16)
- **py_test**: Yellow (#eab308)
- **proto_library**: Indigo (#6366f1)
- **filegroup**: Gray (#94a3b8)
- **genrule**: Red (#e11d48)
- **Others**: Default Gray (#6b7280)

## API Integration

The feature uses multiple API endpoints for different use cases:

### Standard Query Endpoint
- **POST /api/query**: Executes Bazel queries with XML output format
- Buffer size increased to 100MB for large graphs
- The server runs `bazel query --output=xml` commands
- Results are parsed and transformed for visualization

### Streaming Endpoints (for very large graphs)
- **POST /api/stream/query**: Streams raw XML or parsed JSON data
  - Supports `parseXml` parameter to stream parsed JSON objects
  - Uses SAX parser for memory-efficient XML parsing
  - No buffer size limitations

- **POST /api/stream/query-compact**: Streams compact JSON format
  - Automatically parses XML to JSON using SAX
  - Outputs deduplicated rules and edges
  - Optimized for frontend consumption

## Example Bazel Workspace

An example Bazel workspace is included in `example-bazel-workspace/` with:
- Sample BUILD files with various target types
- Dependencies between targets for testing
- Different rule types (cc_library, cc_binary, cc_test)

## Technical Stack

- **@xyflow/svelte**: Flow diagram library for Svelte (v0.1.36 for Svelte 4 compatibility)
- **SAX Parser**: Streaming XML parser for memory-efficient processing of large outputs
- **Svelte 4**: Frontend framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling
- **Express**: Backend server for Bazel integration
- **Node.js Streams**: For handling large data efficiently

## Troubleshooting

1. **No graph appears**:
   - Check that the Bazel workspace is properly configured
   - Verify the target pattern is valid
   - Check browser console for errors

2. **"maxBuffer length exceeded" error**:
   - This occurs when the dependency graph is very large
   - Solutions:
     - Use "Direct Dependencies Only" query type to limit scope
     - Set a Max Depth value (e.g., 2-3) to limit traversal depth
     - Use more specific target patterns (e.g., `//lib:specific_target` instead of `//...`)
     - The server buffer has been increased to 100MB to handle larger graphs

3. **Graph is too large to navigate**:
   - Use the filter input to focus on specific targets
   - Use more specific target patterns
   - Use the minimap for navigation
   - Try the "Direct Dependencies Only" option

4. **Nodes overlap**:
   - The hierarchical layout algorithm spaces nodes automatically
   - Zoom out to see the full graph
   - Pan to navigate between sections

## Future Enhancements

- [ ] Different layout algorithms (force-directed, circular)
- [ ] Node grouping by package
- [ ] Edge labels showing dependency types
- [ ] Search functionality within the graph
- [ ] Save/load graph configurations
- [ ] Real-time updates when BUILD files change
- [ ] Integration with Bazel build status
- [ ] Custom node shapes for different target types
