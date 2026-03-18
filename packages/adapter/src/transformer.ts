export interface TransformConfig {
  input?: {
    template: string;
  };
  output?: {
    parse: 'markdown' | 'json' | 'text';
    extract?: Array<{
      pattern: string;
      action: string;
    }>;
  };
}

export class Transformer {
  applyInputTransform(template: string, data: Record<string, unknown>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    const eachRegex = /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    result = result.replace(eachRegex, (_, key, inner) => {
      const items = data[key] as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(items)) return '';
      return items.map(item => {
        let innerResult = inner;
        for (const [k, v] of Object.entries(item)) {
          innerResult = innerResult.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
        return innerResult;
      }).join('');
    });
    
    return result;
  }

  parseOutput(content: string, config: TransformConfig['output']): Record<string, unknown> {
    if (!config) return { raw: content };

    if (config.parse === 'json') {
      try {
        return JSON.parse(content);
      } catch {
        return { raw: content };
      }
    }

    return { raw: content };
  }
}