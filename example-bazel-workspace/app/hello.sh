#!/bin/bash

# Simple shell script that demonstrates a successful Bazel run target
echo "🚀 Starting Hello World Application"
echo "=================================="
echo ""

# Simulate some processing
echo "📊 Processing data..."
sleep 1

# Print some status updates
echo "✓ Initialization complete"
echo "✓ Loading configuration"
echo "✓ Connecting to services"
echo ""

# Print system information
echo "📋 System Information:"
echo "  - Date: $(date)"
echo "  - User: $USER"
echo "  - Directory: $(pwd)"
echo "  - Bazel Target: ${BUILD_WORKSPACE_DIRECTORY:-unknown}"
echo ""

# Simulate some work with progress
echo "🔄 Processing tasks:"
for i in {1..5}; do
    echo "  Task $i: Processing..."
    sleep 0.5
    echo "  Task $i: ✓ Complete"
done

echo ""
echo "=================================="
echo "✅ All tasks completed successfully!"
echo "🎉 Hello from Bazel! Build and run succeeded!"
echo ""

# Exit successfully
exit 0
