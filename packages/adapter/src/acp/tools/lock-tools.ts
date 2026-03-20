export interface LockToolsCallbacks {
  onDeclare: (files: string[]) => Promise<void>;
  onRelease: (files: string[]) => Promise<void>;
}

export interface LockTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      items?: { type: string };
      description: string;
    }>;
    required: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<{ success: boolean; files: string[] }>;
}

export function createLockTools(callbacks: LockToolsCallbacks): Record<string, LockTool> {
  return {
    lock_declare: {
      name: 'lock_declare',
      description: 'Declare intent to modify files. MUST be called before modifying any file.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute paths of files to lock'
          }
        },
        required: ['files']
      },
      handler: async (params: Record<string, unknown>) => {
        const files = params.files as string[];
        await callbacks.onDeclare(files);
        return { success: true, files };
      }
    },
    lock_release: {
      name: 'lock_release',
      description: 'Release file locks after modifications are complete.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Absolute paths of files to release'
          }
        },
        required: ['files']
      },
      handler: async (params: Record<string, unknown>) => {
        const files = params.files as string[];
        await callbacks.onRelease(files);
        return { success: true, files };
      }
    }
  };
}