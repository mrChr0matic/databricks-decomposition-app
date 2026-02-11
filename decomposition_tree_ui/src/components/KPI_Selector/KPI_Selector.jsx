import { useState } from "react";
import "./KPI_styles.scss";
import { useTree } from "../../context/TreeContext";


const KPI_Selector = () => {
  const metrics = [
    "total_amount",
    "trip_distance",
    "passenger_count",
  ];
  const {setKPI} = useTree();

  const [selected, setSelected] = useState("");
  const handleSelect = (e) =>{
    setSelected(e.target.value);
    setKPI(e.target.value);
  }

  return (
    <div className="selector">
      <select value={selected} className="dropdown" onChange={(e) => handleSelect(e)}>
        <option value="">Select KPI Metric</option>
        {metrics.map((kpi, index) => (
          <option key={index} value={kpi}>
            {kpi}
          </option>
        ))}
      </select>
    </div>
  );
};

export default KPI_Selector;
