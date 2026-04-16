// Type declaration so TypeScript understands `import content from '*.md'`.
// tsup inlines the file content as a string at build time via loader: { '.md': 'text' }.
declare module '*.md' {
  const content: string;
  export default content;
}
