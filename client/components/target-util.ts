
export function toFull(target: {package:string, name:string}, prefix = "//"): string {
    return `${prefix}${target.package.replace(prefix, '')}:${target.name}`;
}   