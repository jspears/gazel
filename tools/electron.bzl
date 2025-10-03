"""Bazel rules for building Electron applications."""

def _electron_app_impl(ctx):
    """Implementation of the electron_app rule."""

    # Collect all input files
    inputs = []

    # Add main.js files
    if hasattr(ctx.attr.main_js, "files"):
        inputs.extend(ctx.attr.main_js.files.to_list())
    elif hasattr(ctx.file, "main_js"):
        inputs.append(ctx.file.main_js)

    # Add index.html files
    if hasattr(ctx.attr.index_html, "files"):
        inputs.extend(ctx.attr.index_html.files.to_list())
    elif hasattr(ctx.file, "index_html"):
        inputs.append(ctx.file.index_html)

    # Add asset files
    for asset in ctx.attr.assets:
        if hasattr(asset, "files"):
            inputs.extend(asset.files.to_list())

    # Determine which Electron binary to use based on platform
    # For now, we'll use Darwin ARM64 as default (Apple Silicon)
    electron_binary = ctx.file._electron_binary_darwin_arm64
    inputs.append(electron_binary)

    # Create a simple bundler script inline
    bundler_content = """#!/bin/bash
set -e

OUTPUT_TAR="$1"
APP_NAME="$2"
MAIN_JS="$3"
INDEX_HTML="$4"
ELECTRON_BINARY="$5"
shift 5

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Extract Electron binary
unzip -q "$ELECTRON_BINARY" -d "$TEMP_DIR"

# Create app directory structure
APP_DIR="$TEMP_DIR/Electron.app/Contents/Resources/app"
mkdir -p "$APP_DIR"

# Copy main process files
cp -r "$MAIN_JS"/* "$APP_DIR/" 2>/dev/null || cp "$MAIN_JS" "$APP_DIR/main.js"

# Copy renderer files
if [ -d "$INDEX_HTML" ]; then
    cp -r "$INDEX_HTML"/* "$APP_DIR/"
else
    cp "$INDEX_HTML" "$APP_DIR/index.html"
fi

# Copy additional assets
for asset in "$@"; do
    if [ -f "$asset" ]; then
        cp "$asset" "$APP_DIR/"
    elif [ -d "$asset" ]; then
        cp -r "$asset"/* "$APP_DIR/"
    fi
done

# Create package.json if it doesn't exist
if [ ! -f "$APP_DIR/package.json" ]; then
    cat > "$APP_DIR/package.json" << EOF
{
  "name": "${APP_NAME,,}",
  "version": "1.0.0",
  "main": "main.js",
  "type": "module"
}
EOF
fi

# Rename the app
mv "$TEMP_DIR/Electron.app" "$TEMP_DIR/$APP_NAME.app"

# Create tar archive
tar -czf "$OUTPUT_TAR" -C "$TEMP_DIR" "$APP_NAME.app"
"""

    # Write bundler script
    bundler = ctx.actions.declare_file(ctx.label.name + "_bundler.sh")
    ctx.actions.write(
        output = bundler,
        content = bundler_content,
        is_executable = True,
    )

    # Get paths for arguments
    main_js_path = ctx.attr.main_js.files.to_list()[0].path if hasattr(ctx.attr.main_js, "files") else ctx.file.main_js.path
    index_html_path = ctx.attr.index_html.files.to_list()[0].path if hasattr(ctx.attr.index_html, "files") else ctx.file.index_html.path

    # Run the bundler to create the app
    ctx.actions.run(
        executable = bundler,
        inputs = inputs,
        arguments = [
            ctx.outputs.app_tar.path,
            ctx.attr.app_name,
            main_js_path,
            index_html_path,
            electron_binary.path,
        ] + [f.path for f in inputs if f.path not in [main_js_path, index_html_path, electron_binary.path]],
        outputs = [ctx.outputs.app_tar],
        env = {
            "BAZEL_BINDIR": ".",
        },
    )

    # Create the run script
    run_script_content = """#!/bin/bash
set -e

# Extract and run the Electron app
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

tar -xzf "$BUILD_WORKSPACE_DIRECTORY/bazel-bin/{package}/{tar}" -C "$TEMP_DIR"

# Run the app
open "$TEMP_DIR/{app_name}.app"
""".format(
        package = ctx.label.package,
        tar = ctx.outputs.app_tar.basename,
        app_name = ctx.attr.app_name,
    )

    ctx.actions.write(
        output = ctx.outputs.run_script,
        content = run_script_content,
        is_executable = True,
    )

    return [
        DefaultInfo(
            executable = ctx.outputs.run_script,
            files = depset([ctx.outputs.app_tar]),
            runfiles = ctx.runfiles(files = [ctx.outputs.app_tar]),
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
        "main_js": attr.label(
            mandatory = True,
            doc = "Main JavaScript file or library for Electron",
        ),
        "index_html": attr.label(
            mandatory = True,
            doc = "Main HTML file or build output for the application",
        ),
        "assets": attr.label_list(
            allow_files = True,
            default = [],
            doc = "Additional asset files to include in the app",
        ),
        "_electron_binary_darwin_arm64": attr.label(
            default = Label("@electron_darwin_arm64//file"),
            allow_single_file = True,
            doc = "Electron binary for Darwin ARM64",
        ),
        "_electron_binary_darwin_x64": attr.label(
            default = Label("@electron_darwin_x64//file"),
            allow_single_file = True,
            doc = "Electron binary for Darwin x64",
        ),
    },
    outputs = {
        "app_tar": "%{name}.tar.gz",
        "run_script": "%{name}_run.sh",
    },
)
