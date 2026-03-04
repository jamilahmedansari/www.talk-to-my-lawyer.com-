import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

const plugins = [react(), tailwindcss(), jsxLocPlugin()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // ─── Vendor splitting: isolate heavy libraries ───
          if (id.includes('node_modules')) {
            // Tiptap rich text editor (attorney review only)
            if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('@tiptap/pm')) {
              return 'vendor-tiptap';
            }
            // Recharts (admin/dashboard charts only)
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-recharts';
            }
            // Stripe (payment pages only)
            if (id.includes('@stripe') || id.includes('stripe')) {
              return 'vendor-stripe';
            }
            // Supabase client
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // Radix UI primitives
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            // Framer Motion animations
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            // PDF generation (approval flow only)
            if (id.includes('pdfkit') || id.includes('fontkit') || id.includes('png-js') || id.includes('brotli')) {
              return 'vendor-pdf';
            }
            // AI SDK (server-side, but may leak into client)
            if (id.includes('ai-sdk') || id.includes('@ai-sdk')) {
              return 'vendor-ai';
            }
            // Lucide icons
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // React core
            if (id.includes('react-dom') || id.includes('react/')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
