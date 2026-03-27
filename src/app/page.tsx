export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Crypto Token Analyzer</h1>
      <p className="text-lg text-gray-600 mb-8">
        TEE-verified token risk analysis powered by OpenGradient
      </p>
      <div className="flex gap-4">
        <a
          href="/api/health"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Health Check
        </a>
        <a
          href="/api/smoke-test"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Smoke Test
        </a>
      </div>
    </main>
  );
}
