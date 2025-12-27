/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@xenova/transformers',
      'fluent-ffmpeg',
      'ffmpeg-static'
    ]
  }
};

module.exports = nextConfig;
