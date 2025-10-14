import { type Interceptor } from "@connectrpc/connect";
import { storage } from "./storage.js";

/**
 * Client-side interceptor to add metadata headers to all outgoing requests
 * This ensures the server knows which workspace and executable to use
 */
export const metadataInterceptor: Interceptor = (next) => async (req) => {
  // Get workspace and executable from localStorage
  const workspace = storage.getPreference('lastWorkspace');
  const executable = storage.getPreference('bazelExecutable');

  // Add metadata as headers
  if (workspace) {
    req.header.set('bazel-workspace', workspace);
  }

  if (executable) {
    req.header.set('bazel-executable', executable);
  }

  // Continue with the request
  return next(req);
};

