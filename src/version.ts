import { createRequire } from 'node:module';

const pkg = createRequire(import.meta.url)('../package.json') as { name: string; version: string };

export const PACKAGE_NAME: string = pkg.name;
export const PACKAGE_VERSION: string = pkg.version;
export const USER_AGENT = `${PACKAGE_NAME}/${PACKAGE_VERSION} (+https://trustmydocs.com)`;
