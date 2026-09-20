import { defineConfig } from 'rolldown'

export default defineConfig({
    platform: 'node',
    input: 'src/server.ts',
    output: {
        dir: 'bundle',
        format: 'esm',
        comments: false,
    },
    transform: {
        typescript: {},
    },
    tsconfig: true,
})
