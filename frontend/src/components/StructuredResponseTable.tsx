import type { StructuredResponse } from "../types";

export default function StructuredResponseTable({
  structured,
}: {
  structured: StructuredResponse;
}) {
  // Filter out duplicate rows (comparing normalized row contents)
  const rows = (structured.rows || []).filter((row, idx, arr) => {
    return (
      idx ===
      arr.findIndex((r) => {
        const cell0A = String(r[0] ?? "").trim().toLowerCase();
        const cell0B = String(row[0] ?? "").trim().toLowerCase();
        if (cell0A && cell0A === cell0B) {
          if (r.length > 1 && row.length > 1) {
            const cell1A = String(r[1] ?? "").trim().toLowerCase();
            const cell1B = String(row[1] ?? "").trim().toLowerCase();
            return cell1A === cell1B;
          }
          return true;
        }
        return JSON.stringify(r) === JSON.stringify(row);
      })
    );
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 12, marginBottom: 4 }}>
      {structured.title && (
        <div
          style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 11,
            color: "var(--ocean-bright)",
            fontWeight: 700,
            letterSpacing: "0.06em",
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          {structured.title}
        </div>
      )}

      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border-mid)",
          borderRadius: 4,
          background: "var(--surface-2)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: 12,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {structured.columns && structured.columns.length > 0 && (
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-mid)", background: "var(--surface-3)" }}>
                {structured.columns.map((col, idx) => {
                  const isRightAligned = ["Rank", "Distance", "SST", "Chlorophyll", "Wave", "Suitability", "Estimated Time", "Value", "Risk"].includes(col) || col.includes("Latitude") || col.includes("Longitude");
                  return (
                    <th
                      key={idx}
                      style={{
                        padding: "8px 12px",
                        fontWeight: 600,
                        color: "var(--text-bright)",
                        textAlign: isRightAligned ? "right" : "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  );
                })}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  borderBottom: rIdx < rows.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {row.map((cell, cIdx) => {
                  const colName = structured.columns ? structured.columns[cIdx] : "";
                  const isRightAligned = ["Rank", "Distance", "SST", "Chlorophyll", "Wave", "Suitability", "Estimated Time", "Value", "Risk"].includes(colName) || colName.includes("Latitude") || colName.includes("Longitude");
                  const isTextColumn = ["Hazard", "Condition", "Route", "Variable", "Headline"].includes(colName);
                  const displayValue = cell === null || cell === undefined ? "—" : cell;
                  
                  return (
                    <td
                      key={cIdx}
                      style={{
                        padding: "8px 12px",
                        color: "var(--text-mid)",
                        textAlign: isRightAligned ? "right" : "left",
                        whiteSpace: isTextColumn ? "normal" : "nowrap",
                        minWidth: isTextColumn ? 160 : undefined,
                        maxWidth: isTextColumn ? 360 : undefined,
                      }}
                    >
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>

        </table>
      </div>

      {structured.source && (
        <div
          style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            color: "var(--text-faint)",
            marginTop: 8,
            textAlign: "right",
          }}
        >
          {structured.source}
        </div>
      )}
    </div>
  );
}
