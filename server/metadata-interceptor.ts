import { type Interceptor } from "@connectrpc/connect";
import { setWorkspace, setBazelExecutable, config } from "./config.js";
import { default as bazelService } from "./services/bazel.js";

/**
 * Server-side interceptor to extract metadata from request headers
 * and configure the server accordingly
 */
export const metadataInterceptor: Interceptor = (next) => async (req) => {
  // Extract metadata from headers
  const workspace = req.header.get('bazel-workspace');
  const executable = req.header.get('bazel-executable');

  // Apply metadata to server config if provided
  if (workspace != config.bazelWorkspace) {
    setWorkspace(workspace);
    bazelService.setWorkspace(workspace);
    console.log(`[Metadata] Set workspace from header: ${workspace}`);
  }

  if (executable != config.bazelExecutable) {
    const actualPath = setBazelExecutable(executable);
    console.log(`[Metadata] Set bazel executable from header: ${actualPath}`);
    
    // Also update the BazelService instance
    bazelService.setBazelExecutable(actualPath);
  }

  // Continue with the request
  return next(req);
};

