import {
  createContext,
  useContext,
  useState,
  useEffect
} from "react";

import {
  getSplitData,
  getTotalSales,
  getAvailableDims
} from "../api/api";

const TreeContext = createContext();

export const TreeProvider = ({ children }) => {

  const [kpi, setKPI] = useState("");
  const [levels, setLevels] = useState([]);
  const [path, setPath] = useState([]);
  const [allDims, setAllDims] = useState([]);
  const [availableDims, setAvailableDims] = useState([]);
  const [currentDim, setCurrentDim] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedTable, setSelectedTable] = useState("");

  // Fetch dims once on mount
  useEffect(() => {
    const fetchDims = async () => {
      try {
        const res = await getAvailableDims();
        setAllDims(res.dims);
        setAvailableDims(res.dims);
      } catch (err) {
        console.error("Failed to fetch dims:", err);
      }
    };
    fetchDims();
  }, []);

  // Wait for BOTH kpi and allDims before building tree
  useEffect(() => {
    if (!kpi || allDims.length === 0) return;
    rebuildTree(allDims);
  }, [kpi, allDims]);

  const buildFilters = (p) => {
    const f = {};
    p.forEach(x => { f[x.dim] = x.value; });
    return f;
  };

  const fetchRoot = async () => {
    const res = await getTotalSales("bi_taxi", kpi);
    return {
      dim: kpi,
      items: [{ node_name: "Total", value: res.total }]
    };
  };

  const rebuildTree = async (currentAllDims = allDims) => {
    const dimsToReplay = levels.slice(1).map(l => l.dim);
    const savedPath = [...path];
    let newLevels = [];

    const rootLevel = await fetchRoot();
    newLevels = [rootLevel];
    setLevels(newLevels);

    let replayPath = [];
    for (let i = 0; i < dimsToReplay.length; i++) {
      const dim = dimsToReplay[i];
      const data = await getSplitData({
        table: "bi_taxi",
        kpi_metric: kpi,
        split_col: dim,
        filters: buildFilters(replayPath)
      });
      newLevels = [...newLevels, { dim, items: data }];
      setLevels([...newLevels]);
      if (savedPath[i]) replayPath.push(savedPath[i]);
    }

    setPath(savedPath);

    const usedDims = newLevels.map(l => l.dim).filter(d => d !== kpi);
    setAvailableDims(currentAllDims.filter(d => !usedDims.includes(d)));
    setCurrentDim(usedDims[usedDims.length - 1] || "");
    setLoading(false);
  };

  const drillDown = () => {
    if (!selectedValue) return path;
    const newPath = [...path, { dim: currentDim, value: selectedValue }];
    setPath(newPath);
    setSelectedValue("");
    return newPath;
  };

  const fetchSplit = async (dim, overridePath = null) => {
    if (!kpi || !dim) return;
    const activePath = overridePath ?? path;
    setLoading(true);

    const data = await getSplitData({
      table: "bi_taxi",
      kpi_metric: kpi,
      split_col: dim,
      filters: buildFilters(activePath)
    });

    const newLevels = [...levels, { dim, items: data }];
    setLevels(newLevels);
    setCurrentDim(dim);
    setAvailableDims(prev => prev.filter(d => d !== dim));
    setLoading(false);
  };

  const resetTree = async () => {
    setPath([]);
    setAvailableDims(allDims);
    setSelectedValue("");
    setCurrentDim("");
    const root = await fetchRoot();
    setLevels([root]);
  };

  const closeLevel = (levelIndex) => {
    const newLevels = levels.slice(0, levelIndex);
    setLevels(newLevels);

    const usedDims = newLevels.map(l => l.dim).filter(d => d !== kpi);
    console.log("useddimes is ", usedDims);

    const newPath = path.slice(0, Math.max(0, usedDims.length - 2));
    setPath(newPath);
    setAvailableDims(allDims.filter(d => !usedDims.includes(d)));
    setCurrentDim(usedDims[usedDims.length - 1] || "");
    setSelectedValue("");
  };

  return (
    <TreeContext.Provider value={{
      kpi, setKPI,
      levels,
      path,
      loading,
      availableDims,
      selectedValue,
      setSelectedValue,
      drillDown,
      fetchSplit,
      resetTree,
      closeLevel
    }}>
      {children}
    </TreeContext.Provider>
  );
};

export const useTree = () => useContext(TreeContext);