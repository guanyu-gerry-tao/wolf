// Type declaration so TypeScript understands `import content from '*.md'`
// and `import content from '*.toml'`. tsup inlines the file content as a
// string at build time via loader: { '.md': 'text', '.toml': 'text' }.
declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.toml' {
  const content: string;
  export default content;
}
