import { registerHooks } from 'node:module';

// Nodeの直接実行でも、Webのtsconfig/Viteと同じ共有契約を読む。
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === '@contracts' ? new URL('../../api/src/contracts/index.ts', import.meta.url).href : specifier,
      context,
    );
  },
});
