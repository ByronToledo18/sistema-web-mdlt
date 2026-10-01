/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Imágenes de productos, servicios y diseños IA subidas a Vercel Blob.
    // Debe coincidir con OPTIMIZABLE_HOST en lib/images.ts.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
}

export default nextConfig