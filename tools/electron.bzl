"""Bazel rules for building Electron applications."""

def _electron_app_impl(ctx):
    """Implementation of the electron_app rule."""

    # Determine which Electron binary to use based on platform
    # For now, we'll use Darwin ARM64 as default (Apple Silicon)
    electron_binary = ctx.file._electron_binary_darwin_arm64

    # Run the bundler to create the app
    ctx.actions.run(
        executable = ctx.executable._bundler,
        inputs = [
            ctx.file.main_js,
            ctx.file.index_html,
            electron_binary,
        ] + ctx.files.assets,
        arguments = [
            ctx.outputs.app_tar.path,
            ctx.attr.app_name,
            ctx.file.main_js.path,
            ctx.file.index_html.path,
            electron_binary.path,
        ] + [f.path for f in ctx.files.assets],
        outputs = [ctx.outputs.app_tar],
        env = {
            "BAZEL_BINDIR": ".",
        },
    )
    
    # Create the run script from template
    ctx.actions.expand_template(
        template = ctx.file._run_script_template,
        output = ctx.outputs.run_script,
        substitutions = {
            "{{app_tar}}": ctx.outputs.app_tar.short_path,
            "{{app_name}}": ctx.attr.app_name,
        },
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
            allow_single_file = [".js"],
            doc = "Main JavaScript file for Electron",
        ),
        "index_html": attr.label(
            mandatory = True,
            allow_single_file = [".html"],
            doc = "Main HTML file for the application",
        ),
        "assets": attr.label_list(
            allow_files = True,
            doc = "Additional asset files to include in the app",
        ),
        "_bundler": attr.label(
            default = Label("//electron:bundler"),
            executable = True,
            cfg = "exec",
            doc = "Bundler tool to package the Electron app",
        ),
        "_run_script_template": attr.label(
            default = Label("//electron:run.sh.tpl"),
            allow_single_file = True,
            doc = "Template for the run script",
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
        "app_tar": "%{name}.tar",
        "run_script": "%{name}.sh",
    },
)
