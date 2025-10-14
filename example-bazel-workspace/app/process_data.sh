#!/bin/bash

# Data processing script
echo "📈 Data Processor v1.0"
echo "----------------------"

# Accept command line arguments
INPUT_FILE=${1:-"default_input.txt"}
OUTPUT_FILE=${2:-"output.txt"}

echo "Configuration:"
echo "  Input:  $INPUT_FILE"
echo "  Output: $OUTPUT_FILE"
echo ""

# Simulate data processing
echo "Processing stages:"
echo "  [1/4] Reading input..."
sleep 0.3
echo "  [2/4] Validating data..."
sleep 0.3
echo "  [3/4] Transforming data..."
sleep 0.3
echo "  [4/4] Writing output..."
sleep 0.3

echo ""
echo "✅ Data processing complete!"
echo "Processed $(( RANDOM % 1000 + 100 )) records successfully"

exit 0
