import { useState } from "react";
import "./KPI_styles.scss";
import { useTree } from "../../context/TreeContext";

const KPI_Selector = () => {

  const { setKPI, availableKPIs } = useTree();
  const [selected, setSelected] = useState("");

  const handleSelect = (e) => {
    const value = e.target.value;
    setSelected(value);
    setKPI(value);
  };

  return (
    <div className="selector">
      <select
        value={selected}
        className="dropdown"
        onChange={handleSelect}
      >
        <option value="">Select KPI Metric</option>

        {availableKPIs.map((kpi) => (
          <option key={kpi} value={kpi}>
            {kpi}
          </option>
        ))}

      </select>
    </div>
  );
};

export default KPI_Selector;