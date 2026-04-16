export default {
    input: 'src/server.ts',
    output: {
        dir: 'bundle',
        platform: 'node',
        format: 'es',
        transform: {
            typescript: {
                onlyRemoveTypeImports: true,
            },
        },
        comments: false,
    },
    tsconfig: true,
}
