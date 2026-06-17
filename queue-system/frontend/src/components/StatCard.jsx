export default function StatCard({ label, value, icon, color = 'text-amazon-orange' }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`text-4xl ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}
