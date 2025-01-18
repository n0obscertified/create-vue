import * as path from "jsr:@std/path@1";
import denoConfig from '../deno.json' with { type: "json" };
// console.log(denoConfig)
const ignoreFiles = ['DS_Store', '.DS_Store']
const ignoreDirs = ['.vscode', '.github', '.husky', '.DS_Store']

 export async function fetchTemplates() {
    const downloadedPaths: string[] = [];
    
    async function fetchAndWriteFile(url: string, localPath: string) {
        console.log("Fetching", url)
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const content = await response.text();
            console.log("Writing", localPath)
            // Create directories if they don't exis    t
            const dir = path.dirname(localPath);
            await Deno.mkdir(dir, { recursive: true });

            // Write file
            await Deno.writeTextFile(localPath, content);
            downloadedPaths.push(localPath);
            console.log(`✓ Written ${localPath}`);
        } catch (error) {
            console.error(`✗ Failed to fetch ${url}:`, error);
        }
    }

    async function cleanup() {
        console.log("\nCleaning up...");
        // Remove files in reverse order (deepest first)
        for (const filePath of downloadedPaths.reverse()) {
            try {
                await Deno.remove(filePath);
                console.log(`✓ Removed ${filePath}`);

                // Try to remove parent directories if empty
                let dirPath = path.dirname(filePath);
                while (dirPath !== '.') {
                    try {
                        await Deno.remove(dirPath);
                        console.log(`✓ Removed empty directory ${dirPath}`);
                    } catch {
                        // Directory not empty or already removed
                        break;
                    }
                    dirPath = path.dirname(dirPath);
                }
            } catch (error) {
                console.error(`✗ Failed to remove ${filePath}:`, error);
            }
        }
    }

    // Add cleanup on process exit
    globalThis.addEventListener("unload", cleanup);
    // Add cleanup on Ctrl+C
    Deno.addSignalListener("SIGINT", async () => {
        console.log("Detected Ctrl+C, cleaning up...")
        await cleanup();
        Deno.exit();
    });

    const JSR_BASE = "https://jsr.io/@denovue/create-vue";
    const VERSION = denoConfig.version;

    // Traverse customMappings and fetch each file
    const asyncTraversals: Promise<void>[] = [] 
    let templatePath =  denoConfig.customMappings['template'] as Record<string, unknown>
    
    function traverse(startPath: Record<string, unknown>) {
        if(typeof startPath === 'string') {
            const url = `${JSR_BASE}/${VERSION}/${startPath}`;
            if(ignoreFiles.includes(startPath)) {
                console.log("Ignoring", startPath)
                return
            }
            if(!url.includes('DS_Store')) {
                asyncTraversals.push(fetchAndWriteFile(url, startPath));
            }
        } else {
            for (const key of Object.keys(startPath)) {
                const nestedPath = (startPath as Record<string, unknown>)[key]
                if(ignoreDirs.includes(key)) {
                    console.log("Ignoring", key)
                    continue
                }
                if(typeof nestedPath === 'string') {
                    const url = `${JSR_BASE}/${VERSION}/${nestedPath}`;
                    if(!url.includes('DS_Store')) {
                        asyncTraversals.push(fetchAndWriteFile(url, nestedPath));
                    }
                } else {
                    traverse(nestedPath as Record<string, unknown>)
                }
            }
        }
    }
    traverse(templatePath)
    console.log(asyncTraversals)
    return Promise.allSettled(asyncTraversals)
}

if (import.meta.main) {
//   await fetchTemplates();
  console.log("Done")
}