import DashboardCard from '../components/DashboardCard'
import '../styles/dashboard.css'

function Dashboard() {
  return (
    <div className="dashboard">

      <DashboardCard
        title="Današnji termini"
        value="3 rezervacije"
      />

      <DashboardCard
        title="Današnji prihod"
        value="126 €"
      />

      <DashboardCard
        title="Zaposlenici"
        value="3 aktivna"
      />

    </div>
  )
}

export default Dashboard