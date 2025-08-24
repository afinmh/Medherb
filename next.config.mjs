/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tambahkan fungsi async rewrites ini
  async rewrites() {
    return [
      {
        // Aturan ini akan mencocokkan SEMUA path
        // Contoh: /about -> /about.html
        // Contoh: /products/item -> /products/item.html
        source: '/:path*',
        destination: '/:path*.html',
      },
    ];
  },
};

export default nextConfig;