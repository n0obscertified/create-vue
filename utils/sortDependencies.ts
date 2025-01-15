interface DenoJson {
  nodeModulesDir?: "auto" | boolean;
  name?: string;
  exports?: string;
  version?: string;
  license?: string;
  imports?: Record<string, string>;
  compilerOptions?: Record<string, unknown>;
  unstable?: string[];
}

export default function sortDependencies(denoJson: DenoJson): DenoJson {
  const sorted: Partial<DenoJson> = {}
  
  if (denoJson.imports) {
    sorted.imports = {}
    Object.keys(denoJson.imports)
      .sort()
      .forEach((name) => {
        sorted.imports![name] = denoJson.imports![name]
      })
  }

  return {
    ...denoJson,
    ...sorted,
  }
}
