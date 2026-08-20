import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['dist/test/**/*.test.js'],
        setupFiles: ['./dist/test/setup.js'],
    },
})
