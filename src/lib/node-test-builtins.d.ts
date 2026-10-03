declare module "node:fs" {
  export const readFileSync: (...args: any[]) => any;
  export const readdirSync: (...args: any[]) => any;
  export const statSync: (...args: any[]) => any;
  const fs: {
    readFileSync: typeof readFileSync;
    readdirSync: typeof readdirSync;
    statSync: typeof statSync;
    [key: string]: any;
  };
  export default fs;
}

declare module "node:path" {
  export const join: (...parts: any[]) => string;
  const path: {
    join: typeof join;
    resolve: (...parts: any[]) => string;
    dirname: (value: string) => string;
    [key: string]: any;
  };
  export default path;
}

declare module "node:url" {
  export const fileURLToPath: (value: any) => string;
}
