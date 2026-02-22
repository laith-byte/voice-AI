import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
      <div className="text-center px-6">
        <p className="text-sm font-medium text-gray-400 mb-2">404</p>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Page not found
        </h1>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-navy-900 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-navy-800 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
