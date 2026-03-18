export interface LockDeclaration {
  action: 'request_lock' | 'release_lock';
  files: string[];
}

export class LockInterceptor {
  private declarePattern = /\[DECLARE\]\s*我要修改:\s*(.+)/g;
  private releasePattern = /\[RELEASE\]\s*(.+)/g;

  parseDeclarations(output: string): LockDeclaration[] {
    const declarations: LockDeclaration[] = [];
    
    let match;
    while ((match = this.declarePattern.exec(output)) !== null) {
      const files = match[1].split(',').map(f => f.trim());
      declarations.push({ action: 'request_lock', files });
    }
    
    this.declarePattern.lastIndex = 0;
    while ((match = this.releasePattern.exec(output)) !== null) {
      const files = match[1].split(',').map(f => f.trim());
      declarations.push({ action: 'release_lock', files });
    }
    
    return declarations;
  }

  injectLockResult(output: string, file: string, granted: boolean, holder?: string): string {
    const prefix = granted 
      ? `[LOCK GRANTED] ${file}\n` 
      : `[LOCK DENIED] ${file} - 被 ${holder} 锁定\n`;
    return prefix + output;
  }
}