import { defineConfig } from 'rolldown'

export default defineConfig({
    platform: 'node',
    input: 'src/server.ts',
    output: {
        dir: 'bundle',
        format: 'esm',
        transform: {
            typescript: {
                onlyRemoveTypeImports: true,
            },
        },
        comments: false,
    },
    tsconfig: true,
})
