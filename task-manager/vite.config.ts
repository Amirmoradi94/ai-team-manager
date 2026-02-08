import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable source maps for production (disable in production for smaller bundles)
    sourcemap: mode === 'development',
    // Reduce chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          'motion': ['framer-motion'],
          'charts': ['recharts'],
          'date': ['date-fns'],
          'ui': ['lucide-react'],
          // Component chunks
          'calendar': [
            './src/components/Calendar/WeeklyCalendar.tsx',
            './src/components/Calendar/CalendarHeader.tsx',
            './src/components/Calendar/CalendarTimeSlot.tsx',
            './src/components/Calendar/CalendarTaskChip.tsx',
          ],
          'analytics': [
            './src/components/Analytics/AnalyticsDashboard.tsx',
            './src/components/Analytics/PerformanceMetrics.tsx',
            './src/components/Analytics/TaskDistribution.tsx',
            './src/components/Analytics/TeamPerformance.tsx',
          ],
          'settings': [
            './src/components/Settings/SettingsPage.tsx',
            './src/components/Settings/ProfileSettings.tsx',
            './src/components/Settings/AppearanceSettings.tsx',
            './src/components/Settings/NotificationSettings.tsx',
            './src/components/Settings/WorkspaceSettings.tsx',
          ],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production', // Remove console.logs in production
        drop_debugger: true,
      },
    },
  },
}));
