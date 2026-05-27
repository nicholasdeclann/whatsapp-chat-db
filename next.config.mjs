/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Required for GitHub Pages when repo is not at the root
  // Set NEXT_PUBLIC_BASE_PATH to your repo name, e.g. "/whatsapp-chat-db"
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  images: { unoptimized: true },
};

export default nextConfig;
