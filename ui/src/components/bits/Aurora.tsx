export function Aurora() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-1/2 left-1/2 h-[80vh] w-[120vw] -translate-x-1/2 animate-aurora opacity-30 blur-3xl"
        style={{
          background:
            'linear-gradient(120deg, hsl(217 91% 60% / 0.4), hsl(280 80% 60% / 0.25), hsl(190 90% 55% / 0.3), hsl(217 91% 60% / 0.4))',
          backgroundSize: '200% 200%',
        }}
      />
    </div>
  );
}
