import * as path from "jsr:@std/path@1";
import * as fs from "jsr:@std/fs@1.0.9";
import denoConfig from '../deno.json' with { type: "json" }

export async function generateMappings(pathsToTraverse: string[] = ['./template']) {
  async function traverseDirectory(dir: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    const files = Deno.readDir(dir);
    
    for await (const file of files) {
      const fullPath = path.join(dir, file.name);
      const stat = await Deno.stat(fullPath);
      
      if (stat.isDirectory) {
        result[file.name] = await traverseDirectory(fullPath);
      } else {
        // Store file path relative to project root
        result[file.name] = fullPath;
      }
    }
    
    return result;
  }

  const mappings: Record<string, any> = {};

  for (const dirPath of pathsToTraverse) {
    if (fs.existsSync(dirPath)) {
      const key = dirPath.startsWith('./') ? dirPath.slice(2) : dirPath;
      mappings[key] = await traverseDirectory(dirPath);
    }
  }

  // Update deno.json with mappings
  (denoConfig as Record<string, unknown>)['customMappings'] = mappings;
  Deno.writeFileSync('./deno.json', new TextEncoder().encode(JSON.stringify(denoConfig, null, 2)));
}