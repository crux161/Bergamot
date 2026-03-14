declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}

declare module "*.ttf" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.icns" {
  const src: string;
  export default src;
}

interface Window {
  bergamot: {
    platform: string;
    versions: {
      electron: string;
      node: string;
      chrome: string;
    };
  };
}
