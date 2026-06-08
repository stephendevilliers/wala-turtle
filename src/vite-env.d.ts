/// <reference types="vite/client" />

declare module "*.webm" {
  const src: string;
  export default src;
}

declare module "*.webp" {
  const src: string;
  export default src;
}
