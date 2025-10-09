
export function toFull(target: {package:string, name:string}, prefix = "//"): string {
    // If the package already contains a colon, it's likely a full target path
    if (target.package.includes(':')) {
        // Return as-is, just ensure it starts with //
        return target.package.startsWith('//') ? target.package : `${prefix}${target.package}`;
    }

    // Remove any leading // from package to avoid duplication
    const cleanPackage = target.package.startsWith('//')
        ? target.package.substring(2)
        : target.package;

    // Construct the full target path
    return `${prefix}${cleanPackage}:${target.name}`;
}