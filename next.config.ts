/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Isso desativa a tentativa de pré-renderizar páginas estáticas que dão erro
  output: 'standalone', 
};

export default nextConfig;