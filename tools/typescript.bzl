"""TypeScript language rules."""

load("@aspect_bazel_lib//lib:copy_to_directory.bzl", "copy_to_directory")
load("@aspect_bazel_lib//lib:directory_path.bzl", "make_directory_path")
load("@aspect_bazel_lib//lib:write_source_files.bzl", "write_source_files")
load("@aspect_rules_js//js:defs.bzl", "js_library")
load("@aspect_rules_ts//ts:proto.bzl", _ts_proto_library = "ts_proto_library")

def ts_proto_library(
        name,
        proto,
        copy_files = True,
        deps = [],
        data = [],
        files_to_copy = None,
        **kwargs):
    """Rule for generated protobuf TypeScript libraries.

    Args:
        name: The name of the rule
        proto: The proto_library target to generate the ts_proto_library for
        copy_files: Deprecated parameter. Used to control whether a `.copy` target is produced,
            but we now always generate it.
        deps: The other `ts_proto_library` targets this target depends on.
        data: The data dependencies of the rule (typically you should be using deps instead to
            add ts_proto_library dependencies).
        files_to_copy: The list of output files to generate. If None, the default is used.
        **kwargs: Additional arguments to pass to the ts_proto_library

    Usage

        proto_library(
            name = "my_proto",
            srcs = ["my.proto"],
        )

        ts_proto_library(
            name = "my_ts_grpc",
            protos = [":my_proto"],
        )
    """
    if files_to_copy == None:
        proto_prefix = proto.replace("_proto", "").replace(":", "")
        files_to_copy = [
            "{}_pb.d.ts".format(proto_prefix),
            "{}_pb.js".format(proto_prefix),
        ]

    _ts_proto_library(
        name = name,
        proto = proto,
        deps = deps,
        data = data,
        files_to_copy = files_to_copy,
        # We don't use the built-in copy_files as it produces a diff test target that
        # will fail in CI when stubs aren't committed in source tree which we don't want.
        copy_files = False,
        **kwargs
    )

    _copy_ts_proto_library_source_files(
        target_name = name,
        files_to_copy = files_to_copy,
        # A little hacky, but to match how callers have called this function.
        # data should also be `ts_proto_library` targets that could be in deps.
        deps = deps + data,
        visibility = kwargs.get("visibility", ["//visibility:private"]),
    )

def _copy_ts_proto_library_source_files(
        target_name,
        files_to_copy,
        deps,
        visibility):
    """Macro for copying ts_proto_library generated files to source tree.

    Args:
        target_name: The name of the ts_proto_library target to copy source files from
            (should be in the same package as where this is invoked).
        files_to_copy: The list of files to copy.
        deps: The deps of the ts_proto_library target. Used to generate a `copy_with_all_deps`
            target that can be used to copy the source files for all targets this
            depends on as well.
        visibility: The visibility of the generated targets.
    """

    # Code is basically just a mirror of the internals of `_ts_proto_library`, but
    # separated out so we can copy files without producing the diff test.
    types_target = "{}.types".format(target_name)
    dir_target = "_{}.directory".format(target_name)
    copy_target = "{}.generate_stubs".format(target_name)

    # We have to use a filegroup to extract the "types" output group from the target
    # (otherwise when used as src you just get the js files).
    native.filegroup(
        name = types_target,
        srcs = [target_name],
        output_group = "types",
        visibility = visibility,
    )

    copy_to_directory(
        name = dir_target,
        # This includes both types and the js files.
        srcs = [types_target, target_name],
        root_paths = ["**"],
    )

    write_source_files(
        name = copy_target,
        files = {
            f: make_directory_path("_{}.{}_dirpath".format(target_name, f), dir_target, f)
            for f in files_to_copy
        },
        diff_test = False,
        visibility = ["//visibility:public"],
    )

    upstream_copy_targets = [
        "{}.generate_stubs_with_all_deps".format(dep)
        for dep in deps
    ]

    write_source_files(
        name = "{}.generate_stubs_with_all_deps".format(target_name),
        additional_update_targets = [copy_target] + upstream_copy_targets,
        diff_test = False,
        visibility = ["//visibility:public"],
    )

def ts_proto_library_bundle(
        name,
        deps,
        visibility = None,
        **kwargs):
    """Rule for bundling multiple ts_proto_library targets for convenience.

    This will produce an equivalent set of targets to `ts_proto_library` (e.g.: a
    js_library target of the same name, a `.generate_stubs` target), but without
    requiring that you pass a `proto_library` target. Instead you can just bundle
    multiple `ts_proto_library` targets together.

    This target should then be usable like any other `ts_proto_library` target.

    Args:
        name: The name of the rule
        deps: The ts_proto_library targets to bundle
        visibility: The visibility of the rule
        **kwargs: Additional arguments to pass to the js_library
    """

    # Create js_library bundling the sources
    js_library(
        name = name,
        deps = deps,
        visibility = visibility,
        **kwargs
    )

    # Collect types from all dependencies
    types_kwargs = {
        "name": "{}.types".format(name),
        "srcs": ["{}.types".format(dep) for dep in deps],
    }
    if visibility != None:
        types_kwargs["visibility"] = visibility
    native.filegroup(**types_kwargs)

    # Create write_source_files targets matching what a regular `ts_proto_library`
    # target produces.
    write_source_files(
        name = "{}.generate_stubs".format(name),
        additional_update_targets = [
            "{}.generate_stubs".format(dep)
            for dep in deps
        ],
        diff_test = False,
        visibility = ["//visibility:public"],
    )

    write_source_files(
        name = "{}.generate_stubs_with_all_deps".format(name),
        additional_update_targets = [
            "{}.generate_stubs_with_all_deps".format(dep)
            for dep in deps
        ],
        diff_test = False,
        visibility = ["//visibility:public"],
    )
