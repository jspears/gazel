#!/usr/bin/env python3
"""Bundler for Electron applications.

This script takes an Electron binary and app files, and bundles them
into a tar archive that can be extracted and run.
"""

import sys
import os
import zipfile
import tarfile
import tempfile
import shutil
import json
from pathlib import Path


def extract_electron(electron_zip_path, extract_dir):
    """Extract the Electron binary from the zip file, preserving symlinks."""
    print(f"Extracting Electron from {electron_zip_path}")

    # Use system unzip command to preserve symlinks
    # Python's zipfile module doesn't handle symlinks properly
    import subprocess
    result = subprocess.run(['unzip', '-q', electron_zip_path, '-d', extract_dir],
                          capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Failed to extract Electron: {result.stderr}")

    print(f"Extracted to {extract_dir}")


def create_app_bundle(temp_dir, app_name, main_js_path, index_html_path, asset_paths):
    """Create the app bundle with the provided files."""
    # Find the Electron.app in the extracted files
    electron_app_path = None
    for root, dirs, files in os.walk(temp_dir):
        if 'Electron.app' in dirs:
            electron_app_path = os.path.join(root, 'Electron.app')
            break
    
    if not electron_app_path:
        raise Exception("Could not find Electron.app in extracted files")
    
    # Rename Electron.app to the app name
    app_bundle_path = os.path.join(temp_dir, f"{app_name}.app")
    shutil.move(electron_app_path, app_bundle_path)
    
    # Create the app directory inside the bundle
    app_resources_dir = os.path.join(app_bundle_path, 'Contents', 'Resources', 'app')
    os.makedirs(app_resources_dir, exist_ok=True)
    
    # Copy main.js
    shutil.copy2(main_js_path, os.path.join(app_resources_dir, 'main.js'))
    
    # Copy index.html
    shutil.copy2(index_html_path, os.path.join(app_resources_dir, 'index.html'))
    
    # Copy additional assets
    for asset_path in asset_paths:
        if os.path.isfile(asset_path):
            shutil.copy2(asset_path, app_resources_dir)
        elif os.path.isdir(asset_path):
            # Copy directory contents
            dest_dir = os.path.join(app_resources_dir, os.path.basename(asset_path))
            shutil.copytree(asset_path, dest_dir)
    
    # Create package.json
    package_json = {
        "name": app_name,
        "version": "1.0.0",
        "main": "main.js"
    }
    with open(os.path.join(app_resources_dir, 'package.json'), 'w') as f:
        json.dump(package_json, f, indent=2)
    
    # Update Info.plist to use the app name
    info_plist_path = os.path.join(app_bundle_path, 'Contents', 'Info.plist')
    if os.path.exists(info_plist_path):
        with open(info_plist_path, 'r') as f:
            content = f.read()
        # Replace Electron with app name in key places
        content = content.replace('<string>Electron</string>', f'<string>{app_name}</string>', 1)
        content = content.replace('<string>com.github.Electron</string>', f'<string>com.gazel.{app_name}</string>')
        with open(info_plist_path, 'w') as f:
            f.write(content)
    
    return app_bundle_path


def create_tar_archive(app_bundle_path, output_tar_path):
    """Create a tar archive of the app bundle."""
    print(f"Creating tar archive at {output_tar_path}")

    # First, fix permissions on the executable
    executable_path = os.path.join(app_bundle_path, 'Contents', 'MacOS', 'Electron')
    if os.path.exists(executable_path):
        os.chmod(executable_path, 0o755)
        print(f"Set execute permissions on {executable_path}")

    # Fix permissions on the main framework
    framework_path = os.path.join(app_bundle_path, 'Contents', 'Frameworks',
                                  'Electron Framework.framework', 'Versions', 'A',
                                  'Electron Framework')
    if os.path.exists(framework_path):
        os.chmod(framework_path, 0o755)
        print(f"Set execute permissions on {framework_path}")

    # Also fix permissions on helper executables
    helpers_dir = os.path.join(app_bundle_path, 'Contents', 'Frameworks',
                              'Electron Framework.framework', 'Versions', 'A', 'Helpers')
    if os.path.exists(helpers_dir):
        for helper in os.listdir(helpers_dir):
            helper_path = os.path.join(helpers_dir, helper)
            if os.path.isfile(helper_path) and not os.path.islink(helper_path):
                os.chmod(helper_path, 0o755)
                print(f"Set execute permissions on {helper_path}")

    # Fix permissions on libraries
    libs_dir = os.path.join(app_bundle_path, 'Contents', 'Frameworks',
                           'Electron Framework.framework', 'Versions', 'A', 'Libraries')
    if os.path.exists(libs_dir):
        for lib in os.listdir(libs_dir):
            if lib.endswith('.dylib'):
                lib_path = os.path.join(libs_dir, lib)
                if os.path.isfile(lib_path) and not os.path.islink(lib_path):
                    os.chmod(lib_path, 0o755)
                    print(f"Set execute permissions on {lib_path}")

    # Create tar with proper symlink handling
    with tarfile.open(output_tar_path, 'w') as tar:
        # Add the app bundle to the tar, preserving symlinks
        app_name = os.path.basename(app_bundle_path)
        tar.add(app_bundle_path, arcname=app_name, filter=None)

    print(f"Created tar archive: {output_tar_path}")


def main():
    if len(sys.argv) < 6:
        print("Usage: bundler.py <output_tar> <app_name> <main_js> <index_html> <electron_zip> [assets...]")
        sys.exit(1)
    
    output_tar = sys.argv[1]
    app_name = sys.argv[2]
    main_js_path = sys.argv[3]
    index_html_path = sys.argv[4]
    electron_zip_path = sys.argv[5]
    asset_paths = sys.argv[6:] if len(sys.argv) > 6 else []
    
    print(f"Building Electron app: {app_name}")
    print(f"Output: {output_tar}")
    print(f"Main JS: {main_js_path}")
    print(f"Index HTML: {index_html_path}")
    print(f"Electron ZIP: {electron_zip_path}")
    print(f"Assets: {asset_paths}")
    
    # Create a temporary directory for extraction
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extract Electron
        extract_electron(electron_zip_path, temp_dir)
        
        # Create the app bundle
        app_bundle_path = create_app_bundle(
            temp_dir, app_name, main_js_path, index_html_path, asset_paths
        )
        
        # Create the tar archive
        create_tar_archive(app_bundle_path, output_tar)
    
    print(f"Successfully created {app_name} bundle")


if __name__ == "__main__":
    main()
