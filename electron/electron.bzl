"""Custom Bazel rules for building Electron applications"""

def _electron_app_impl(ctx):
    """Implementation of the electron_app rule."""
    
    # Create a script to bundle the Electron app
    bundle_script = ctx.actions.declare_file(ctx.label.name + "_bundle.sh")
    ctx.actions.write(
        output = bundle_script,
        content = """#!/bin/bash
set -e

APP_NAME="{app_name}"
OUTPUT_DIR="{output_dir}"
ELECTRON_MAIN="{electron_main}"
ELECTRON_PRELOAD="{electron_preload}"
SERVER_FILES="{server_files}"
CLIENT_FILES="{client_files}"
NODE_MODULES="{node_modules}"

# Create output directory structure
mkdir -p "$OUTPUT_DIR/$APP_NAME.app/Contents/Resources/app"

# Copy Electron main and preload scripts
cp "$ELECTRON_MAIN" "$OUTPUT_DIR/$APP_NAME.app/Contents/Resources/app/main.js"
cp "$ELECTRON_PRELOAD" "$OUTPUT_DIR/$APP_NAME.app/Contents/Resources/app/preload.js"

# Copy server files
cp -r "$SERVER_FILES" "$OUTPUT_DIR/$APP_NAME.app/Contents/Resources/app/server"

# Copy client build files
cp -r "$CLIENT_FILES" "$OUTPUT_DIR/$APP_NAME.app/Contents/Resources/app/client"

# Create package.json
cat > "$OUTPUT_DIR/$APP_NAME.app/Contents/Resources/app/package.json" << 'EOF'
{{
  "name": "{app_name}",
  "version": "{version}",
  "main": "main.js",
  "description": "{description}"
}}
EOF

# Copy necessary node_modules
cp -r "$NODE_MODULES" "$OUTPUT_DIR/$APP_NAME.app/Contents/Resources/app/node_modules"

echo "Electron app bundled at $OUTPUT_DIR/$APP_NAME.app"
""".format(
            app_name = ctx.attr.app_name,
            output_dir = ctx.outputs.app_bundle.dirname,
            electron_main = ctx.file.main_js.path,
            electron_preload = ctx.file.preload_js.path,
            server_files = ctx.files.server_files[0].dirname if ctx.files.server_files else "",
            client_files = ctx.files.client_files[0].dirname if ctx.files.client_files else "",
            node_modules = ctx.files.node_modules[0].dirname if ctx.files.node_modules else "",
            version = ctx.attr.version,
            description = ctx.attr.description,
        ),
        is_executable = True,
    )
    
    # Create the run script
    run_script = ctx.actions.declare_file(ctx.label.name + "_run.sh")
    ctx.actions.write(
        output = run_script,
        content = """#!/bin/bash
set -e

# Find the Electron executable
if command -v electron &> /dev/null; then
    ELECTRON_BIN="electron"
elif [ -f "node_modules/.bin/electron" ]; then
    ELECTRON_BIN="node_modules/.bin/electron"
elif [ -f "$RUNFILES_DIR/node_modules/.bin/electron" ]; then
    ELECTRON_BIN="$RUNFILES_DIR/node_modules/.bin/electron"
else
    echo "Error: Electron executable not found"
    exit 1
fi

# Run the Electron app
if [ "$1" == "--dev" ]; then
    NODE_ENV=development $ELECTRON_BIN {main_js_path}
else
    NODE_ENV=production $ELECTRON_BIN {main_js_path}
fi
""".format(
            main_js_path = ctx.file.main_js.short_path,
        ),
        is_executable = True,
    )
    
    # Collect all runfiles
    runfiles = ctx.runfiles(
        files = [
            ctx.file.main_js,
            ctx.file.preload_js,
            run_script,
        ] + ctx.files.server_files + ctx.files.client_files + ctx.files.node_modules,
    )
    
    return [
        DefaultInfo(
            executable = run_script,
            files = depset([run_script, ctx.outputs.app_bundle]),
            runfiles = runfiles,
        ),
    ]

electron_app = rule(
    implementation = _electron_app_impl,
    executable = True,
    attrs = {
        "app_name": attr.string(
            mandatory = True,
            doc = "Name of the Electron application",
        ),
        "version": attr.string(
            default = "1.0.0",
            doc = "Version of the application",
        ),
        "description": attr.string(
            default = "",
            doc = "Description of the application",
        ),
        "main_js": attr.label(
            mandatory = True,
            allow_single_file = [".js"],
            doc = "The main Electron process JavaScript file",
        ),
        "preload_js": attr.label(
            mandatory = True,
            allow_single_file = [".js"],
            doc = "The preload script for Electron",
        ),
        "server_files": attr.label_list(
            allow_files = True,
            doc = "Server files to include in the app",
        ),
        "client_files": attr.label_list(
            allow_files = True,
            doc = "Client build files to include in the app",
        ),
        "node_modules": attr.label_list(
            allow_files = True,
            doc = "Node modules to include",
        ),
    },
    outputs = {
        "app_bundle": "%{name}_bundle.tar",
    },
)

def _electron_package_impl(ctx):
    """Implementation of the electron_package rule for creating distributable packages."""
    
    package_script = ctx.actions.declare_file(ctx.label.name + "_package.sh")
    ctx.actions.write(
        output = package_script,
        content = """#!/bin/bash
set -e

echo "Building Electron distributable packages..."

# Use electron-builder to create packages
npx electron-builder \\
    --config {config_file} \\
    --{platform} \\
    --dir {output_dir}

echo "Packages created successfully!"
""".format(
            config_file = ctx.file.config.path,
            platform = ctx.attr.platform,
            output_dir = ctx.outputs.package_dir.dirname,
        ),
        is_executable = True,
    )
    
    return [
        DefaultInfo(
            executable = package_script,
            files = depset([package_script, ctx.outputs.package_dir]),
        ),
    ]

electron_package = rule(
    implementation = _electron_package_impl,
    executable = True,
    attrs = {
        "config": attr.label(
            mandatory = True,
            allow_single_file = [".json", ".js"],
            doc = "Electron Builder configuration file",
        ),
        "platform": attr.string(
            default = "mac",
            values = ["mac", "win", "linux"],
            doc = "Target platform for the package",
        ),
        "app_files": attr.label_list(
            allow_files = True,
            doc = "Application files to package",
        ),
    },
    outputs = {
        "package_dir": "%{name}_dist",
    },
)

def electron_workspace():
    """Macro to set up Electron workspace dependencies."""
    
    # This would be called from WORKSPACE to set up Electron-specific dependencies
    # For now, we're using npm-managed Electron, but this could download
    # platform-specific Electron binaries if needed
    pass
