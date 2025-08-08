declare module 'fabric' {
  export const fabric: any;
  export default fabric;
}

declare namespace fabric {
  // Minimal type aliases so references like fabric.Canvas compile
  type Canvas = any;
  type Image = any;
  type IText = any;
}

