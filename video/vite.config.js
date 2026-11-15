import { defineConfig } from 'vite'

// Never run with --host (localhost only). Relative base so frame_server.py can serve dist/.
export default defineConfig({ base: './', server: { host: '127.0.0.1' }, build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', southpole: 'southpole.html' } } } })
