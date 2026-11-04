import { defineConfig } from 'vite';
const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? '';

export default defineConfig({
    define: {
        'import.meta.env.VITE_PILOT_RELEASE': JSON.stringify(/^[a-f0-9]{40}$/.test(commit) ? commit : ''),
    },
    build: { rollupOptions: { input: { main: 'index.html', connection: 'connection.html', workspace: 'workspace.html' } } },
});
