import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
export const candidate = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repository = resolve(candidate, '../..');
// Both dependencies are already locked in this repository; no new manifest/workspace.
export const dependencies = resolve(repository, 'experiments/architecture-verification/node_modules');
export const compiler = resolve(repository, 'packages/prediction/node_modules/typescript/bin/tsc');
export const existingRequire = createRequire(join(dependencies, 'react/package.json'));
export function requireSetup() {
  for (const name of [compiler, join(dependencies,'react/package.json'),join(dependencies,'react-dom/package.json'),join(dependencies,'vite/package.json')]) {
    if (!existsSync(name)) throw new Error('Missing existing verification dependencies. Follow this candidate README setup commands.');
  }
}
function typedFiles(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory()
    ? typedFiles(join(dir,entry.name))
    : /\.tsx?$/.test(entry.name) ? [join(dir,entry.name)] : []);
}
export function project(module, outDir) {
  const qa = join(candidate,'.qa'); mkdirSync(qa,{recursive:true});
  const config = join(qa,`tsconfig-${module}.json`);
  writeFileSync(config,JSON.stringify({compilerOptions:{target:'ES2022',module,moduleResolution:'Node',jsx:'react-jsx',
    strict:true,noUnusedLocals:true,noUnusedParameters:true,skipLibCheck:false,lib:['ES2022','DOM','DOM.Iterable'],
    rootDir:candidate,outDir,baseUrl:candidate,
    paths:{react:[join(dependencies,'@types/react/index.d.ts')],'react/jsx-runtime':[join(dependencies,'@types/react/jsx-runtime.d.ts')],
      'react-dom/client':[join(dependencies,'@types/react-dom/client.d.ts')]},
    typeRoots:[join(dependencies,'@types')],types:['react','react-dom']},
    files:['src','examples','tests'].flatMap(dir=>typedFiles(join(candidate,dir)))},null,2)+'\n');
  return config;
}
