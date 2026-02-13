import './items.scss'
import { useTree } from "../../context/TreeContext";
import { motion, AnimatePresence } from "framer-motion";

const Items = () => {
  const { path, levels, closeLevel } = useTree();

  const isInPath = (dim, value) => {
    return path.some(p =>
      String(p.dim).toLowerCase().trim() === String(dim).toLowerCase().trim() &&
      String(p.value).toLowerCase().trim() === String(value).toLowerCase().trim()
    );
  };

  return (
    <div className="tree-container">

      
      {levels.length === 0 && (
        <div className="empty-level">
          Select a KPI to start building the Tree
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {levels.map((level, idx) => {

          const total = level.items.reduce((s,i)=>s+i.value,0);

          return (
            <motion.div
              className="level"
              key={level.dim + idx}
              layout
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3 }}
            >

              {/* ---------- Sticky Header ---------- */}
              <div className="level-header">
                <div className="level-top">
                  <h4 className='dim-title'>{level.dim}</h4>

                  <div className="close-button" onClick={()=>closeLevel(idx)}>
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                <hr className='underline'/>
              </div>

              {/* ---------- Scrollable Items ---------- */}
              <div className="items-wrap">
                {level.items.map(item => {
                  const pct = (item.value/total)*100;

                  return (
                    <div className="item" key={item.node_name}>
                      <div className="content">
                        <div>
                          <span className={
                            idx === 0 || isInPath(level.dim, item.node_name)
                              ? "text-selected"
                              : ""
                          }>
                            {item.node_name}
                          </span>
                          {" : "}
                          <span className="percentage">
                            {pct.toFixed(2)}%
                          </span>
                        </div>

                        <div>
                          {Number(item.value).toFixed(2)}
                        </div>
                      </div>

                      <div className="box">
                        <div
                          className={
                            idx === 0 || isInPath(level.dim, item.node_name)
                              ? "bar-selected"
                              : "bar-fill"
                          }
                          style={{width:`${pct}%`}}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

            </motion.div>
          );
        })}
      </AnimatePresence>

    </div>
  );
};

export default Items;
