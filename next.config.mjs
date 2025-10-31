/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // 🔥 Ignora errores ESLint en Vercel
  },
};

export default nextConfig;
