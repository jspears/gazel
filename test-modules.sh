#!/bin/bash

# Test the modules endpoint
echo "Testing Modules API endpoint..."
echo ""

# Test the graph endpoint
echo "1. Testing /api/modules/graph:"
curl -s http://localhost:3003/api/modules/graph | jq '.'

echo ""
echo "2. Testing /api/modules/info/example_workspace:"
curl -s http://localhost:3003/api/modules/info/example_workspace | jq '.'
