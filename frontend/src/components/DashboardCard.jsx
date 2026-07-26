function DashboardCard({ title, value }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="value">{value}</p>
    </div>
  )
}

export default DashboardCard