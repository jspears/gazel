import { ConnectError, type Interceptor } from "@connectrpc/connect";

export const loggingInterceptor: Interceptor = (next) => async (req) => {
      const startTime = performance.now();
      try {
        const response = await next(req);
        const endTime = performance.now();
        console.log(
          `RPC call to ${req.method.name} completed in ${endTime - startTime}ms`
        );
        return response;
      } catch (error) {
        const endTime = performance.now();
        if (error instanceof ConnectError) {
          console.error(
            `RPC call to ${req.method.name} failed with error: ${error.message} (Code: ${error.code}) in ${endTime - startTime}ms`
          );
        } else {
          console.error(
            `RPC call to ${req.method.name} failed with unexpected error: ${error} in ${endTime - startTime}ms`
          );
        }
        throw error; // Re-throw the error to propagate it
      }
    };