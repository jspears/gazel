#!/usr/bin/env python3
"""
Prepare the client app for Electron by updating paths in the built index.html
"""

import sys
import os
import shutil
import re

def prepare_app(dist_dir, output_dir):
    """
    Copy the built app and update paths for Electron
    """
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Copy assets directory
    assets_src = os.path.join(dist_dir, 'assets')
    assets_dst = os.path.join(output_dir, 'assets')
    if os.path.exists(assets_dst):
        shutil.rmtree(assets_dst)
    shutil.copytree(assets_src, assets_dst)
    
    # Read and update index.html
    index_src = os.path.join(dist_dir, 'index.html')
    with open(index_src, 'r') as f:
        html = f.read()
    
    # Update paths to be relative (remove leading /)
    html = html.replace('src="/', 'src="./') 
    html = html.replace('href="/', 'href="./')
    html = html.replace('from "/', 'from "./')
    
    # Remove the highlight.js stylesheet reference (not needed for Electron)
    html = re.sub(r'<link rel="stylesheet" href="[^"]*styles/default\.min\.css">', '', html)
    
    # Write updated index.html
    index_dst = os.path.join(output_dir, 'index.html')
    with open(index_dst, 'w') as f:
        f.write(html)
    
    print(f"App prepared in {output_dir}")
    print(f"- Copied assets directory")
    print(f"- Updated index.html with relative paths")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: prepare-app.py <dist_dir> <output_dir>")
        sys.exit(1)
    
    dist_dir = sys.argv[1]
    output_dir = sys.argv[2]
    
    prepare_app(dist_dir, output_dir)
