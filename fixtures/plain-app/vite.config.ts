import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// No Tailwind here: the styles come prebuilt from the two styles.css files.
export default defineConfig({
  plugins: [react()],
});
