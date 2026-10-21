// SQL migrations are bundled as plain text (see `loader` in angular.json).
declare module '*.sql' {
  const content: string;
  export default content;
}
