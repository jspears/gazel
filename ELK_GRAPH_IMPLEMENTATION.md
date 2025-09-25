# ELK.js Layout Implementation for Bazel Dependency Graphs

## Overview

We've successfully integrated ELK.js (Eclipse Layout Kernel) for automatic graph layout in your Gazel project, along with icons to differentiate between targets, tasks, and files. This provides a much more organized and visually clear representation of Bazel dependencies.

## Key Features

### 1. **ELK.js Layout Algorithm**
- Automatic hierarchical layout using the layered algorithm
- Support for both vertical (top-down) and horizontal (left-right) layouts
- Optimized spacing and edge routing
- Handles complex dependency graphs efficiently

### 2. **Visual Differentiation with Icons**
Different node types are now visually distinguished using icons from Lucide:

#### Build Targets
- **cc_library** 📦 (Package icon) - Blue
- **cc_binary** 🔢 (Binary icon) - Green  
- **cc_test** 🧪 (TestTube icon) - Orange
- **java_library** 📦 (Package icon) - Purple
- **java_binary** 🔢 (Binary icon) - Pink
- **java_test** 🧪 (TestTube icon) - Orange
- **py_library** 📦 (Package icon) - Cyan
- **py_binary** 🔢 (Binary icon) - Lime
- **py_test** 🧪 (TestTube icon) - Yellow

#### File Types
- **Source files** 📄 (FileCode icon) - Green
- **Header files** 📝 (FileText icon) - Blue
- **Proto files** 📋 (FileType icon) - Indigo
- **Filegroups** 📁 (FolderOpen icon) - Gray

#### Other Rules
- **genrule** ⚙️ (Cog icon) - Red
- **Targets** 🎯 (Target icon) - Purple
- **Default/Unknown** 📦 (Box icon) - Gray

### 3. **Edge Styling**
Different dependency types are shown with distinct edge styles:
- **deps**: Solid blue lines with arrow heads
- **srcs**: Dashed green lines
- **hdrs**: Dotted cyan lines
- **inputs**: Thin gray lines
- **outputs**: Animated orange lines

## Implementation Details

### Components Created/Modified

1. **`client/components/ElkDependencyGraph.svelte`**
   - Main component using ELK.js for layout
   - Parses Bazel XML and creates nodes with icons
   - Applies ELK layout algorithm
   - Supports layout direction switching

2. **`client/components/CustomNode.svelte`**
   - Custom node component displaying icons
   - Shows node label and type
   - Hover effects and tooltips
   - Color-coded based on node type

3. **`server/services/enhancedXmlParser.ts`**
   - Enhanced XML parser extracting deps, srcs, hdrs lists
   - Creates structured dependency data
   - Filters out tool dependencies

4. **`server/routes/stream.ts`**
   - Added `/api/stream/query-enhanced` endpoint
   - Streaming support for large graphs

## Usage

### Basic Usage
1. Navigate to the Graph tab in Gazel
2. Enter a Bazel target pattern (e.g., `//app:main`)
3. Enable "Enhanced visualization" toggle
4. Click "Generate Graph"

### Layout Options
- **Vertical Layout**: Top-down hierarchy (default)
- **Horizontal Layout**: Left-right flow
- Toggle between layouts using the buttons in the top-left panel

### Features
- **Zoom/Pan**: Use mouse wheel to zoom, drag to pan
- **MiniMap**: Overview in bottom-right corner
- **Controls**: Zoom controls in bottom-left
- **Tooltips**: Hover over nodes to see full path and location
- **Export**: Export as SVG or DOT format

## ELK Configuration

The ELK layout is configured with these options:

```javascript
{
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '80',
  'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
}
```

These settings provide:
- Clear hierarchical structure
- Minimal edge crossings
- Optimal node placement
- Consistent spacing

## Benefits

1. **Improved Clarity**: Icons and colors make it immediately clear what type of node you're looking at
2. **Better Organization**: ELK's layered algorithm creates clean, hierarchical layouts
3. **Scalability**: Can handle large dependency graphs efficiently
4. **Flexibility**: Switch between vertical and horizontal layouts based on preference
5. **Professional Appearance**: The graph looks polished and professional

## Example Patterns

### View all dependencies of a target
```
//app:main
```

### View all targets in a package
```
//app:all
```

### View entire workspace
```
//...
```

### View with depth limit
Set "Max Depth" to limit how deep the dependency tree goes.

## Troubleshooting

### Graph is too large
- Use the filter field to focus on specific targets
- Limit the query depth
- Use direct dependencies only option

### Nodes overlapping
- Try switching layout direction
- Adjust browser zoom level
- Use the fit view button

### Missing dependencies
- Ensure the Bazel workspace is properly configured
- Check that the target exists
- Verify the XML output contains the expected data

## Future Enhancements

Potential improvements that could be added:
1. Collapsible node groups
2. Search/highlight functionality
3. Dependency path highlighting
4. Custom layout algorithms for specific use cases
5. Node clustering by package
6. Interactive dependency analysis
7. Performance metrics on nodes

## Technical Notes

- ELK.js runs entirely in the browser, no server-side processing needed
- The layout algorithm is deterministic - same input produces same layout
- Custom nodes are React/Svelte components, fully customizable
- Streaming support allows handling of very large graphs

This implementation provides a solid foundation for visualizing and understanding complex Bazel build dependencies with professional-quality graph layouts and clear visual differentiation between different types of build artifacts.
