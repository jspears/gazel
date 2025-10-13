export function stopPropagation<T extends (event: Event) => any>(fn?:T) {
    return (event: Event): ReturnType<T> => {
        event.stopPropagation();
        return fn?.(event);
    };
}
export function bind<T extends (...args: any[]) => any>(fn:T, ...args: Parameters<T>): ReturnType<T> {
    return function(this: any){
        return fn.call(this, ...args);
    }
}