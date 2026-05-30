/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
    outputFileTracingIncludes: {
      "/api/jobs/[id]/process": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.js"],
    },
  },
};

export default nextConfig;
