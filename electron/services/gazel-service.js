/**
 * Gazel Service for Electron Main Process
 * Provides direct IPC handlers for the Gazel API
 */

const { ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class GazelGrpcService {
  constructor() {
    this.workspace = null;
    this.handlers = new Map();
  }

  /**
   * Initialize the service and register all IPC handlers
   */
  initialize() {
    console.log('[GazelGrpcService] Initializing IPC handlers...');
    
    // Register all handlers directly with ipcMain
    this.registerHandler('grpc:GazelService:getWorkspaceInfo', this.getWorkspaceInfo.bind(this));
    this.registerHandler('grpc:GazelService:getCurrentWorkspace', this.getCurrentWorkspace.bind(this));
    this.registerHandler('grpc:GazelService:scanWorkspaces', this.scanWorkspaces.bind(this));
    this.registerHandler('grpc:GazelService:switchWorkspace', this.switchWorkspace.bind(this));
    this.registerHandler('grpc:GazelService:listTargets', this.listTargets.bind(this));
    this.registerHandler('grpc:GazelService:getTarget', this.getTarget.bind(this));
    this.registerHandler('grpc:GazelService:getTargetDependencies', this.getTargetDependencies.bind(this));
    this.registerHandler('grpc:GazelService:getTargetOutputs', this.getTargetOutputs.bind(this));
    this.registerHandler('grpc:GazelService:getReverseDependencies', this.getReverseDependencies.bind(this));
    this.registerHandler('grpc:GazelService:searchTargets', this.searchTargets.bind(this));
    this.registerHandler('grpc:GazelService:executeQuery', this.executeQuery.bind(this));
    this.registerHandler('grpc:GazelService:streamQuery', this.streamQuery.bind(this));
    this.registerHandler('grpc:GazelService:buildTarget', this.buildTarget.bind(this));
    this.registerHandler('grpc:GazelService:streamBuild', this.streamBuild.bind(this));
    this.registerHandler('grpc:GazelService:runTarget', this.runTarget.bind(this));
    this.registerHandler('grpc:GazelService:testTarget', this.testTarget.bind(this));
    this.registerHandler('grpc:GazelService:cleanTarget', this.cleanTarget.bind(this));
    this.registerHandler('grpc:GazelService:listModules', this.listModules.bind(this));
    this.registerHandler('grpc:GazelService:getModule', this.getModule.bind(this));
    this.registerHandler('grpc:GazelService:getModuleInfo', this.getModuleInfo.bind(this));
    this.registerHandler('grpc:GazelService:getModuleDependencies', this.getModuleDependencies.bind(this));
    this.registerHandler('grpc:GazelService:getModuleGraph', this.getModuleGraph.bind(this));
    this.registerHandler('grpc:GazelService:getWorkspaceFiles', this.getWorkspaceFiles.bind(this));
    this.registerHandler('grpc:GazelService:getWorkspaceConfig', this.getWorkspaceConfig.bind(this));
    this.registerHandler('grpc:GazelService:getBuildFile', this.getBuildFile.bind(this));
    // Query management
    this.registerHandler('grpc:GazelService:getSavedQueries', this.getSavedQueries.bind(this));
    this.registerHandler('grpc:GazelService:saveQuery', this.saveQuery.bind(this));
    this.registerHandler('grpc:GazelService:deleteQuery', this.deleteQuery.bind(this));
    this.registerHandler('grpc:GazelService:getQueryTemplates', this.getQueryTemplates.bind(this));
    // Command history
    this.registerHandler('grpc:GazelService:getCommandHistory', this.getCommandHistory.bind(this));
    this.registerHandler('grpc:GazelService:clearCommandHistory', this.clearCommandHistory.bind(this));
    // Clean
    this.registerHandler('grpc:GazelService:cleanBazel', this.cleanBazel.bind(this));

    console.log('[GazelGrpcService] Registered', this.handlers.size, 'IPC handlers');
  }

  /**
   * Register an IPC handler
   */
  registerHandler(channel, handler) {
    this.handlers.set(channel, handler);
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        console.log(`[GazelGrpcService] Handling ${channel}`);
        const result = await handler(...args);
        return result;
      } catch (error) {
        console.error(`[GazelGrpcService] Error in ${channel}:`, error);
        throw error;
      }
    });
  }

  /**
   * Execute a Bazel command
   */
  async executeBazelCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const cwd = this.workspace || process.cwd();
      const fullCommand = `bazel ${command} ${args.join(' ')}`;
      
      console.log(`[GazelGrpcService] Executing: ${fullCommand} in ${cwd}`);
      
      exec(fullCommand, { cwd, ...options }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[GazelGrpcService] Command failed:`, error);
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  // Workspace operations
  async getWorkspaceInfo(request) {
    const workspace = request?.workspace || this.workspace || process.cwd();
    
    try {
      // Check if it's a valid Bazel workspace
      const workspaceFile = path.join(workspace, 'WORKSPACE');
      const workspaceBazel = path.join(workspace, 'WORKSPACE.bazel');
      const moduleFile = path.join(workspace, 'MODULE.bazel');
      
      const hasWorkspace = fs.existsSync(workspaceFile) || fs.existsSync(workspaceBazel);
      const hasModule = fs.existsSync(moduleFile);
      
      if (!hasWorkspace && !hasModule) {
        return {
          info: {
            path: workspace,
            name: path.basename(workspace),
            type: 'invalid',
            error: 'Not a Bazel workspace'
          }
        };
      }
      
      return {
        info: {
          path: workspace,
          name: path.basename(workspace),
          type: hasModule ? 'bzlmod' : 'workspace'
        }
      };
    } catch (error) {
      return {
        info: {
          path: workspace,
          name: path.basename(workspace),
          type: 'error',
          error: error.message
        }
      };
    }
  }

  async getCurrentWorkspace() {
    return {
      configured: !!this.workspace,
      workspace: this.workspace,
      valid: !!this.workspace,
      error: this.workspace ? null : 'No workspace configured'
    };
  }

  async scanWorkspaces(request) {
    const startPath = request?.path || process.env.HOME;
    const workspaces = [];
    
    // Simple implementation - just return the current workspace
    if (this.workspace) {
      workspaces.push({
        path: this.workspace,
        name: path.basename(this.workspace),
        type: 'current'
      });
    }
    
    return { workspaces };
  }

  async switchWorkspace(request) {
    const newWorkspace = request?.workspace;
    
    if (!newWorkspace) {
      throw new Error('Workspace path is required');
    }
    
    // Validate it's a Bazel workspace
    const info = await this.getWorkspaceInfo({ workspace: newWorkspace });
    
    if (info.info.type === 'invalid' || info.info.type === 'error') {
      throw new Error(`Invalid workspace: ${info.info.error}`);
    }
    
    this.workspace = newWorkspace;
    
    return {
      success: true,
      workspace: newWorkspace,
      message: `Switched to workspace: ${newWorkspace}`
    };
  }

  // List all targets in the workspace
  async listTargets(request) {
    if (!this.workspace) {
      console.log('[GazelGrpcService] No workspace configured');
      return {
        total: 0,
        targets: [],
        by_package: {}
      };
    }

    const pattern = request?.pattern || '//...';
    const format = request?.format || 'label_kind';

    return new Promise((resolve) => {
      const command = `bazel query "${pattern}" --output=${format}`;
      console.log(`[GazelGrpcService] Running: ${command}`);

      // Use the same environment as the shell to ensure bazel is in PATH
      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Failed to list targets:', error.message);
          if (stderr) {
            console.error('[GazelGrpcService] stderr:', stderr);
          }
          resolve({
            total: 0,
            targets: [],
            by_package: {}
          });
        } else {
          // Parse the output
          const lines = stdout.trim().split('\n').filter(line => line.length > 0);
          const targets = [];
          const byPackage = {};

          for (const line of lines) {
            // Parse label_kind format: "rule_type rule //package:target"
            const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
            if (match) {
              const [, kind, pkg, name] = match;
              const label = `${pkg}:${name}`;
              const target = {
                label,
                full: label,     // Add full field
                kind,
                ruleType: kind,  // Add ruleType for compatibility
                type: kind,      // Add type for compatibility
                package: pkg,
                name
              };

              targets.push(target);

              // Group by package
              if (!byPackage[pkg]) {
                byPackage[pkg] = [];
              }
              byPackage[pkg].push(target);
            } else {
              // Try to parse as simple label format
              const labelMatch = line.match(/^(\/\/[^:]+):(.+)$/);
              if (labelMatch) {
                const [, pkg, name] = labelMatch;
                const label = `${pkg}:${name}`;
                const target = {
                  label,
                  full: label,        // Add full field
                  kind: 'unknown',
                  ruleType: 'unknown',  // Add ruleType for compatibility
                  type: 'unknown',      // Add type for compatibility
                  package: pkg,
                  name
                };

                targets.push(target);

                // Group by package
                if (!byPackage[pkg]) {
                  byPackage[pkg] = [];
                }
                byPackage[pkg].push(target);
              }
            }
          }

          console.log(`[GazelGrpcService] Found ${targets.length} targets`);
          resolve({
            total: targets.length,
            targets,
            by_package: byPackage
          });
        }
      });
    });
  }

  async getTarget(request) {
    const targetName = request?.target;

    if (!targetName) {
      return { target: null, error: 'Target name is required' };
    }

    if (!this.workspace) {
      return { target: null, error: 'No workspace configured' };
    }

    return new Promise((resolve) => {
      const command = `bazel query --output=xml "${targetName}"`;
      console.log(`[GazelGrpcService] Getting target info: ${command}`);

      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024,
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Failed to get target:', error.message);
          resolve({ target: null, error: error.message });
        } else {
          // Parse XML output to extract target info
          const xmlContent = stdout.trim();

          // Extract rule class/type
          const ruleMatch = xmlContent.match(/class="([^"]+)"/);
          const ruleType = ruleMatch ? ruleMatch[1] : 'unknown';

          // Extract location
          const locationMatch = xmlContent.match(/location="([^"]+)"/);
          const location = locationMatch ? locationMatch[1] : null;

          // Extract name
          const nameMatch = xmlContent.match(/name="([^"]+)"/);
          const ruleName = nameMatch ? nameMatch[1] : null;

          // Parse attributes from XML
          const attributes = {};

          // Extract string attributes
          const stringAttrs = xmlContent.matchAll(/<string name="([^"]+)" value="([^"]+)"\/>/g);
          for (const match of stringAttrs) {
            attributes[match[1]] = match[2];
          }

          // Extract list attributes
          const listMatches = xmlContent.matchAll(/<list name="([^"]+)">(.*?)<\/list>/gs);
          for (const match of listMatches) {
            const attrName = match[1];
            const listContent = match[2];
            const items = [];

            // Extract labels from list
            const labelMatches = listContent.matchAll(/<label value="([^"]+)"\/>/g);
            for (const labelMatch of labelMatches) {
              items.push(labelMatch[1]);
            }

            // Extract strings from list
            const stringMatches = listContent.matchAll(/<string value="([^"]+)"\/>/g);
            for (const stringMatch of stringMatches) {
              items.push(stringMatch[1]);
            }

            if (items.length > 0) {
              attributes[attrName] = items;
            }
          }

          // Extract boolean attributes
          const boolAttrs = xmlContent.matchAll(/<boolean name="([^"]+)" value="([^"]+)"\/>/g);
          for (const match of boolAttrs) {
            attributes[match[1]] = match[2] === 'true';
          }

          // Extract integer attributes
          const intAttrs = xmlContent.matchAll(/<int name="([^"]+)" value="([^"]+)"\/>/g);
          for (const match of intAttrs) {
            attributes[match[1]] = parseInt(match[2], 10);
          }

          // Parse target name to get package and name
          const targetMatch = targetName.match(/^(\/\/[^:]+):(.+)$/);
          let pkg = '';
          let name = targetName;

          if (targetMatch) {
            [, pkg, name] = targetMatch;
          }

          resolve({
            target: {
              label: targetName,
              full: targetName,
              name: ruleName || name,
              package: pkg,
              type: ruleType,
              ruleType: ruleType,
              kind: ruleType,
              location: location,
              attributes: attributes
            }
          });
        }
      });
    });
  }

  async getTargetDependencies(request) {
    const targetName = request?.target;
    const depth = request?.depth || 1;

    if (!targetName) {
      return {
        target: targetName,
        depth,
        total: 0,
        dependencies: [],
        error: 'Target name is required'
      };
    }

    if (!this.workspace) {
      return {
        target: targetName,
        depth,
        total: 0,
        dependencies: [],
        error: 'No workspace configured'
      };
    }

    return new Promise((resolve) => {
      const command = `bazel query "deps(${targetName}, ${depth})" --output=label_kind`;
      console.log(`[GazelGrpcService] Getting target dependencies: ${command}`);

      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024,
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Failed to get dependencies:', error.message);
          resolve({
            target: targetName,
            depth,
            total: 0,
            dependencies: [],
            error: error.message
          });
        } else {
          const lines = stdout.trim().split('\n').filter(line => line.length > 0);
          const dependencies = [];

          for (const line of lines) {
            // Skip the target itself
            if (line.includes(targetName)) continue;

            // Parse label_kind format
            const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
            if (match) {
              const [, kind, pkg, name] = match;
              const label = `${pkg}:${name}`;
              dependencies.push({
                label,
                full: label,     // Add full field
                kind,
                ruleType: kind,
                type: kind,
                package: pkg,
                name
              });
            }
          }

          console.log(`[GazelGrpcService] Found ${dependencies.length} dependencies`);
          resolve({
            target: targetName,
            depth,
            total: dependencies.length,
            dependencies
          });
        }
      });
    });
  }

  async getTargetOutputs(request) {
    const targetName = request?.target;

    if (!targetName) {
      return {
        target: targetName,
        outputs: [],
        count: 0,
        error: 'Target name is required'
      };
    }

    if (!this.workspace) {
      return {
        target: targetName,
        outputs: [],
        count: 0,
        error: 'No workspace configured'
      };
    }

    return new Promise((resolve) => {
      // Use bazel cquery to get output files
      const command = `bazel cquery ${targetName} --output=files 2>/dev/null || bazel query ${targetName} --output=label 2>/dev/null`;
      console.log(`[GazelGrpcService] Getting target outputs: ${command}`);

      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024,
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Failed to get outputs:', error.message);
          // Return empty outputs on error
          resolve({
            target: targetName,
            outputs: [],
            count: 0,
            error: null // Don't show error as this is optional
          });
        } else {
          const lines = stdout.trim().split('\n').filter(line => line.length > 0);
          const outputs = [];

          for (const line of lines) {
            // Parse file paths
            if (line.startsWith('bazel-')) {
              const filename = path.basename(line);
              const ext = path.extname(line).replace('.', '');
              outputs.push({
                path: line,
                filename,
                type: ext || 'unknown'
              });
            }
          }

          console.log(`[GazelGrpcService] Found ${outputs.length} outputs`);
          resolve({
            target: targetName,
            outputs,
            count: outputs.length,
            error: null
          });
        }
      });
    });
  }

  async getReverseDependencies(request) {
    const targetName = request?.target;

    if (!targetName) {
      return {
        target: targetName,
        total: 0,
        dependencies: [],
        error: 'Target name is required'
      };
    }

    if (!this.workspace) {
      return {
        target: targetName,
        total: 0,
        dependencies: [],
        error: 'No workspace configured'
      };
    }

    return new Promise((resolve) => {
      // Use rdeps to find what depends on this target
      const command = `bazel query "rdeps(//..., ${targetName})" --output=label_kind`;
      console.log(`[GazelGrpcService] Getting reverse dependencies: ${command}`);

      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024,
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Failed to get reverse dependencies:', error.message);
          resolve({
            target: targetName,
            total: 0,
            dependencies: [],
            error: error.message
          });
        } else {
          const lines = stdout.trim().split('\n').filter(line => line.length > 0);
          const dependencies = [];

          for (const line of lines) {
            // Skip the target itself
            if (line.includes(targetName)) continue;

            // Parse label_kind format
            const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
            if (match) {
              const [, kind, pkg, name] = match;
              const label = `${pkg}:${name}`;
              dependencies.push({
                label,
                kind,
                ruleType: kind,
                type: kind,
                package: pkg,
                name,
                full: label
              });
            }
          }

          console.log(`[GazelGrpcService] Found ${dependencies.length} reverse dependencies`);
          resolve({
            target: targetName,
            total: dependencies.length,
            dependencies
          });
        }
      });
    });
  }

  async searchTargets(request) {
    if (!this.workspace) {
      console.log('[GazelGrpcService] No workspace configured');
      return {
        total: 0,
        targets: []
      };
    }

    const query = request?.query || '';
    const pattern = request?.pattern || '//...';

    // Use bazel query with a filter for the search term
    return new Promise((resolve) => {
      const command = `bazel query "${pattern}" --output=label_kind | grep -i "${query}"`;
      console.log(`[GazelGrpcService] Searching targets with: ${command}`);

      // Use the same environment as the shell to ensure bazel is in PATH
      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        // grep returns error code 1 when no matches found, which is ok
        if (error && error.code !== 1) {
          console.error('[GazelGrpcService] Failed to search targets:', error.message);
          resolve({
            total: 0,
            targets: []
          });
        } else {
          // Parse the output
          const lines = stdout.trim().split('\n').filter(line => line.length > 0);
          const targets = [];

          for (const line of lines) {
            // Parse label_kind format: "rule_type rule //package:target"
            const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
            if (match) {
              const [, kind, pkg, name] = match;
              const label = `${pkg}:${name}`;
              targets.push({
                label,
                full: label,     // Add full field
                kind,
                ruleType: kind,  // Add ruleType for compatibility
                type: kind,      // Add type for compatibility
                package: pkg,
                name
              });
            }
          }

          console.log(`[GazelGrpcService] Found ${targets.length} matching targets`);
          resolve({
            total: targets.length,
            targets
          });
        }
      });
    });
  }

  async executeQuery(request) {
    if (!this.workspace) {
      console.log('[GazelGrpcService] No workspace configured');
      return {
        query: request?.query || '',
        output_format: request?.output_format || 'label',
        result: { targets: [] },
        raw: '',
        error: 'No workspace configured'
      };
    }

    const query = request?.query || '//...';
    const outputFormat = request?.output_format || 'label';

    return new Promise((resolve) => {
      const command = `bazel query "${query}" --output=${outputFormat}`;
      console.log(`[GazelGrpcService] Executing query: ${command}`);

      // Use the same environment as the shell to ensure bazel is in PATH
      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Query failed:', error.message);
          resolve({
            query,
            output_format: outputFormat,
            result: { targets: [] },
            raw: '',
            error: error.message
          });
        } else {
          const raw = stdout.trim();
          const lines = raw.split('\n').filter(line => line.length > 0);
          console.log(`[GazelGrpcService] Query returned ${lines.length} results`);

          // Parse the output based on format
          let targets = [];
          if (outputFormat === 'label_kind') {
            // Parse label_kind format: "rule_type rule //package:target"
            for (const line of lines) {
              const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
              if (match) {
                const [, kind, pkg, name] = match;
                const label = `${pkg}:${name}`;
                targets.push({
                  label,
                  full: label,     // Add full field
                  kind,
                  ruleType: kind,
                  type: kind,
                  package: pkg,
                  name
                });
              }
            }
          } else if (outputFormat === 'label') {
            // Parse simple label format: "//package:target"
            for (const line of lines) {
              const match = line.match(/^(\/\/[^:]+):(.+)$/);
              if (match) {
                const [, pkg, name] = match;
                const label = `${pkg}:${name}`;
                targets.push({
                  label,
                  full: label,     // Add full field
                  kind: 'unknown',
                  ruleType: 'unknown',
                  type: 'unknown',
                  package: pkg,
                  name
                });
              }
            }
          }

          resolve({
            query,
            output_format: outputFormat,
            result: { targets },
            raw,
            error: null
          });
        }
      });
    });
  }

  async streamQuery(request) {
    return { result: '' };
  }

  async buildTarget(request) {
    const { target, options = [] } = request || {};

    if (!target) {
      return { success: false, error: 'Target is required' };
    }

    if (!this.workspace) {
      return { success: false, error: 'No workspace configured' };
    }

    return new Promise((resolve) => {
      const args = ['build', target, ...options];
      console.log(`[GazelGrpcService] Running: bazel ${args.join(' ')}`);

      exec(`bazel ${args.join(' ')}`, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Build failed:', error.message);
          resolve({
            success: false,
            output: stdout || '',
            stderr: stderr || error.message,
            error: error.message
          });
        } else {
          console.log('[GazelGrpcService] Build succeeded');
          resolve({
            success: true,
            output: stdout || '',
            stderr: stderr || ''
          });
        }
      });
    });
  }

  async streamBuild(request) {
    const { target, options = [] } = request || {};

    if (!target) {
      return { success: false, error: 'Target is required' };
    }

    if (!this.workspace) {
      return { success: false, error: 'No workspace configured' };
    }

    // For now, just run the build and return the result
    // TODO: Implement actual streaming
    return this.buildTarget(request);
  }

  async runTarget(request) {
    const { target, options = [] } = request || {};

    if (!target) {
      return { success: false, error: 'Target is required' };
    }

    if (!this.workspace) {
      return { success: false, error: 'No workspace configured' };
    }

    return new Promise((resolve) => {
      const args = ['run', target, ...options];
      console.log(`[GazelGrpcService] Running: bazel ${args.join(' ')}`);

      exec(`bazel ${args.join(' ')}`, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Run failed:', error.message);
          resolve({
            success: false,
            output: stdout || '',
            stderr: stderr || error.message,
            error: error.message
          });
        } else {
          console.log('[GazelGrpcService] Run succeeded');
          resolve({
            success: true,
            output: stdout || '',
            stderr: stderr || ''
          });
        }
      });
    });
  }

  async testTarget(request) {
    const { target, options = [] } = request || {};

    if (!target) {
      return { success: false, error: 'Target is required' };
    }

    if (!this.workspace) {
      return { success: false, error: 'No workspace configured' };
    }

    return new Promise((resolve) => {
      const args = ['test', target, ...options];
      console.log(`[GazelGrpcService] Running: bazel ${args.join(' ')}`);

      exec(`bazel ${args.join(' ')}`, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Test failed:', error.message);
          resolve({
            success: false,
            output: stdout || '',
            stderr: stderr || error.message,
            error: error.message
          });
        } else {
          console.log('[GazelGrpcService] Test succeeded');
          resolve({
            success: true,
            output: stdout || '',
            stderr: stderr || ''
          });
        }
      });
    });
  }

  async cleanTarget(request) {
    return { success: false, error: 'Not implemented' };
  }

  // Query management methods
  async getSavedQueries(request) {
    // For now, return empty array - would need persistent storage
    console.log('[GazelGrpcService] getSavedQueries called - returning empty (no persistent storage)');
    return [];
  }

  async saveQuery(request) {
    const { name, query, description } = request || {};

    if (!name || !query) {
      throw new Error('Name and query are required');
    }

    // For now, just return the query - would need persistent storage
    console.log(`[GazelGrpcService] saveQuery called: ${name}`);
    return {
      id: Date.now().toString(),
      name,
      query,
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  async deleteQuery(request) {
    const { id } = request || {};

    if (!id) {
      throw new Error('Query ID is required');
    }

    // For now, just return success - would need persistent storage
    console.log(`[GazelGrpcService] deleteQuery called: ${id}`);
    return { success: true };
  }

  async getQueryTemplates(request) {
    // Return some useful query templates
    return [
      {
        id: '1',
        name: 'All targets',
        query: '//...',
        description: 'List all targets in the workspace'
      },
      {
        id: '2',
        name: 'Dependencies of target',
        query: 'deps(//path:target)',
        description: 'Show all dependencies of a target'
      },
      {
        id: '3',
        name: 'Reverse dependencies',
        query: 'rdeps(//..., //path:target)',
        description: 'Show what depends on a target'
      },
      {
        id: '4',
        name: 'Test targets',
        query: 'kind(".*_test", //...)',
        description: 'Find all test targets'
      },
      {
        id: '5',
        name: 'Binary targets',
        query: 'kind(".*_binary", //...)',
        description: 'Find all binary targets'
      },
      {
        id: '6',
        name: 'Library targets',
        query: 'kind(".*_library", //...)',
        description: 'Find all library targets'
      }
    ];
  }

  // Command history methods
  async getCommandHistory(request) {
    const limit = request?.limit || 50;

    // For now, return empty - would need persistent storage
    console.log(`[GazelGrpcService] getCommandHistory called with limit: ${limit}`);
    return {
      total: 0,
      history: []
    };
  }

  async clearCommandHistory(request) {
    console.log('[GazelGrpcService] clearCommandHistory called');
    return { success: true };
  }

  // Clean methods
  async cleanBazel(request) {
    const expunge = request?.expunge || false;

    if (!this.workspace) {
      return { success: false, error: 'No workspace configured', output: '' };
    }

    return new Promise((resolve) => {
      const command = expunge ? 'bazel clean --expunge' : 'bazel clean';
      console.log(`[GazelGrpcService] Running: ${command}`);

      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024,
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Clean failed:', error.message);
          resolve({
            success: false,
            output: stdout || '',
            error: error.message
          });
        } else {
          console.log('[GazelGrpcService] Clean succeeded');
          resolve({
            success: true,
            output: stdout || 'Clean completed successfully',
            error: null
          });
        }
      });
    });
  }

  async listModules(request) {
    return { modules: [] };
  }

  async getModule(request) {
    return { module: null };
  }

  async getModuleInfo(request) {
    const moduleName = request?.moduleName;

    if (!moduleName) {
      return null;
    }

    if (!this.workspace) {
      console.log('[GazelGrpcService] No workspace configured');
      return null;
    }

    // Try to get module info from bazel mod graph
    return new Promise((resolve) => {
      const command = `bazel mod graph --output json`;
      console.log(`[GazelGrpcService] Getting module info for: ${moduleName}`);

      const env = { ...process.env };
      if (!env.PATH) {
        env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      } else if (!env.PATH.includes('/usr/local/bin')) {
        env.PATH = `/usr/local/bin:${env.PATH}`;
      }

      exec(command, {
        cwd: this.workspace,
        maxBuffer: 10 * 1024 * 1024,
        env: env,
        shell: '/bin/bash'
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GazelGrpcService] Failed to get module info:', error.message);
          resolve(null);
        } else {
          try {
            const graphData = JSON.parse(stdout);

            // Search for the module in the graph
            function findModule(moduleData) {
              if (moduleData.name === moduleName) {
                return {
                  name: moduleData.name,
                  version: moduleData.version || '0.0.0',
                  key: moduleData.key || `${moduleData.name}@${moduleData.version}`,
                  dependencies: moduleData.dependencies || [],
                  apparentName: moduleData.apparentName || moduleData.name,
                  isRoot: moduleData.key === '<root>'
                };
              }

              if (moduleData.dependencies && Array.isArray(moduleData.dependencies)) {
                for (const dep of moduleData.dependencies) {
                  const found = findModule(dep);
                  if (found) return found;
                }
              }

              return null;
            }

            const moduleInfo = findModule(graphData);
            console.log(`[GazelGrpcService] Found module info: ${moduleInfo ? 'yes' : 'no'}`);
            resolve(moduleInfo);
          } catch (parseError) {
            console.error('[GazelGrpcService] Failed to parse module graph:', parseError);
            resolve(null);
          }
        }
      });
    });
  }

  async getModuleDependencies(request) {
    return { dependencies: [] };
  }

  async getModuleGraph(request) {
    if (!this.workspace) {
      console.log('[GazelGrpcService] No workspace configured, returning empty module graph');
      return {
        root: '',
        modules: [],
        dependencies: [],
        statistics: {
          totalModules: 0,
          directDependencies: 0,
          devDependencies: 0,
          indirectDependencies: 0
        }
      };
    }

    const workspace = this.workspace;

    try {
      // Check if MODULE.bazel exists
      const modulePath = path.join(workspace, 'MODULE.bazel');
      if (!fs.existsSync(modulePath)) {
        console.log('[GazelGrpcService] No MODULE.bazel file found');
        return {
          root: workspace,
          modules: [],
          dependencies: [],
          statistics: {
            totalModules: 0,
            directDependencies: 0,
            devDependencies: 0,
            indirectDependencies: 0
          }
        };
      }

      // Try to run bazel mod graph
      return new Promise((resolve) => {
        const command = 'bazel mod graph --output json';
        console.log(`[GazelGrpcService] Running command: ${command} in ${workspace}`);

        // Use the same environment as the shell to ensure bazel is in PATH
        const env = { ...process.env };
        if (!env.PATH) {
          env.PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
        } else if (!env.PATH.includes('/usr/local/bin')) {
          env.PATH = `/usr/local/bin:${env.PATH}`;
        }

        exec(command, {
          cwd: workspace,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          env: env,
          shell: '/bin/bash'
        }, (error, stdout, stderr) => {
          if (error) {
            console.error('[GazelGrpcService] Failed to get module graph:', error.message);
            if (stderr) {
              console.error('[GazelGrpcService] stderr:', stderr);
            }
            // Return empty graph on error
            resolve({
              root: workspace,
              modules: [],
              dependencies: [],
              statistics: {
                totalModules: 0,
                directDependencies: 0,
                devDependencies: 0,
                indirectDependencies: 0
              }
            });
          } else {
            console.log('[GazelGrpcService] bazel mod graph succeeded, output length:', stdout.length);
            try {
              // Parse the JSON output from bazel mod graph
              const graphData = JSON.parse(stdout);

              // Transform the data to match the expected format
              const modules = [];
              const dependencies = [];
              const moduleMap = new Map();
              let directCount = 0;
              let devCount = 0;
              let indirectCount = 0;

              // Recursive function to process module and its dependencies
              function processModule(moduleData, depth = 0, parentKey = null) {
                const key = moduleData.key || `${moduleData.name}@${moduleData.version}`;

                // Skip if already processed (to avoid cycles)
                if (moduleMap.has(key)) {
                  return;
                }

                const module = {
                  key,
                  name: moduleData.name || key.split('@')[0],
                  version: moduleData.version || key.split('@')[1] || '0.0.0',
                  apparentName: moduleData.apparentName || moduleData.name || key.split('@')[0],
                  isRoot: key === '<root>',
                  depth,
                  dependencies: [],
                  dependencyCount: 0,
                  extensionCount: 0
                };

                moduleMap.set(key, module);
                modules.push(module);

                // Process dependencies
                if (moduleData.dependencies && Array.isArray(moduleData.dependencies)) {
                  for (const dep of moduleData.dependencies) {
                    if (!dep.unexpanded) {
                      // Recursively process the dependency
                      processModule(dep, depth + 1, key);
                    }

                    const depKey = dep.key || `${dep.name}@${dep.version}`;
                    module.dependencies.push({
                      key: depKey,
                      name: dep.name,
                      version: dep.version
                    });

                    // Add to global dependencies list
                    dependencies.push({
                      from: key,
                      to: depKey,
                      type: depth === 0 ? 'direct' : 'indirect',
                      version: dep.version
                    });

                    // Count dependency types
                    if (depth === 0) {
                      directCount++;
                    } else {
                      indirectCount++;
                    }
                  }
                  module.dependencyCount = module.dependencies.length;
                }
              }

              // Start processing from the root module
              if (graphData.key === '<root>') {
                processModule(graphData);
              } else if (graphData.depGraph) {
                // Old format support
                for (const [key, moduleData] of Object.entries(graphData.depGraph)) {
                  processModule({ ...moduleData, key });
                }
              }

              console.log(`[GazelGrpcService] Found ${modules.length} modules with ${dependencies.length} dependencies`);

              resolve({
                root: workspace,
                modules,
                dependencies,
                statistics: {
                  totalModules: modules.length,
                  directDependencies: directCount,
                  devDependencies: devCount,
                  indirectDependencies: indirectCount
                }
              });
            } catch (parseError) {
              console.error('[GazelGrpcService] Failed to parse module graph JSON:', parseError);
              // Return empty graph on parse error
              resolve({
                root: workspace,
                modules: [],
                dependencies: [],
                statistics: {
                  totalModules: 0,
                  directDependencies: 0,
                  devDependencies: 0,
                  indirectDependencies: 0
                }
              });
            }
          }
        });
      });
    } catch (error) {
      console.error('[GazelGrpcService] Error getting module graph:', error);
      return {
        root: workspace || '',
        modules: [],
        dependencies: [],
        statistics: {
          totalModules: 0,
          directDependencies: 0,
          devDependencies: 0,
          indirectDependencies: 0
        }
      };
    }
  }

  async getWorkspaceFiles() {
    if (!this.workspace) {
      console.log('[GazelGrpcService] No workspace configured, returning empty file list');
      return { total: 0, files: [] };
    }

    const workspace = this.workspace;
    const files = [];

    try {
      // Use filesystem scan instead of bazel query to avoid configuration issues
      console.log('[GazelGrpcService] Scanning for BUILD files in:', workspace);

      const findBuildFiles = (dir, relativePath = '') => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            // Skip hidden directories and bazel output directories
            if (entry.name.startsWith('.') ||
                entry.name === 'bazel-out' ||
                entry.name === 'bazel-bin' ||
                entry.name === 'bazel-testlogs' ||
                entry.name === 'bazel-' + path.basename(workspace) ||
                entry.name === 'node_modules') {
              continue;
            }

            if (entry.isDirectory()) {
              // Recursively search subdirectories
              const subPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
              findBuildFiles(path.join(dir, entry.name), subPath);
            } else if (entry.name === 'BUILD' || entry.name === 'BUILD.bazel') {
              // Found a BUILD file
              const filePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
              files.push({
                path: filePath,
                type: 'build',
                package: relativePath || '.'
              });
            }
          }
        } catch (err) {
          // Ignore directories we can't read
          if (err.code !== 'EACCES' && err.code !== 'EPERM') {
            console.warn(`[GazelGrpcService] Error reading directory ${dir}:`, err.message);
          }
        }
      };

      // Start scanning from workspace root
      findBuildFiles(workspace);

      console.log(`[GazelGrpcService] Found ${files.length} BUILD files`);
      return { total: files.length, files };
    } catch (error) {
      console.error('[GazelGrpcService] Error getting workspace files:', error);
      return { total: 0, files: [] };
    }
  }

  async getWorkspaceConfig() {
    if (!this.workspace) {
      console.log('[GazelGrpcService] No workspace configured, returning empty config');
      return { bazelrc_exists: false, configurations: {} };
    }

    const workspace = this.workspace;

    try {
      const bazelrcPath = path.join(workspace, '.bazelrc');
      const bazelrc_exists = fs.existsSync(bazelrcPath);
      const configurations = {};

      if (bazelrc_exists) {
        // Parse .bazelrc file for configurations
        const content = fs.readFileSync(bazelrcPath, 'utf8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            // Parse config lines like "build:config_name --flag"
            const match = trimmed.match(/^(build|test|run|query):(\w+)\s+(.+)$/);
            if (match) {
              const configName = match[2];
              const flag = match[3];
              if (!configurations[configName]) {
                configurations[configName] = [];
              }
              configurations[configName].push(flag);
            }
          }
        }
      }

      return { bazelrc_exists, configurations };
    } catch (error) {
      console.error('[GazelGrpcService] Error getting workspace config:', error);
      return { bazelrc_exists: false, configurations: {} };
    }
  }

  async getBuildFile(request) {
    const filePath = request?.path;

    if (!filePath) {
      throw new Error('File path is required');
    }

    if (!this.workspace) {
      throw new Error('No workspace configured');
    }

    const fullPath = path.join(this.workspace, filePath);

    try {
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Read file content
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').length;

      // Parse targets from BUILD file
      const targets = [];
      const targetRegex = /^(\w+)\s*\(\s*name\s*=\s*["']([^"']+)["']/gm;
      let match;
      let lineNum = 1;

      for (const line of content.split('\n')) {
        const lineMatch = line.match(/^(\w+)\s*\(\s*name\s*=\s*["']([^"']+)["']/);
        if (lineMatch) {
          targets.push({
            ruleType: lineMatch[1],
            name: lineMatch[2],
            line: lineNum
          });
        }
        lineNum++;
      }

      console.log(`[GazelGrpcService] Read BUILD file ${filePath}: ${lines} lines, ${targets.length} targets`);

      return {
        path: filePath,
        content,
        targets,
        lines
      };
    } catch (error) {
      console.error('[GazelGrpcService] Error reading BUILD file:', error);
      throw error;
    }
  }
}

module.exports = GazelGrpcService;
